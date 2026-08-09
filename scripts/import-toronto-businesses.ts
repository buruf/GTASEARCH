// Toronto open-data business import (Phase 5A, Task 6).
//
// Pulls the City of Toronto's "Business Licences and Permits" dataset from
// the CKAN open-data portal and upserts a mapped, filtered subset into the
// production `Business` table as source:"open-data" rows.
//
// ---------------------------------------------------------------------
// Dataset (confirmed live 2026-08-01):
//   Package:  municipal-licensing-and-standards-business-licences-and-permits
//             https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=...
//   Active resource (datastore_active: true, format CSV):
//             id = 169e90ba-3ae0-43dd-8b2f-919e87002f50, "Business licences data"
//   Row count at time of writing: 159,459. 92 distinct "Category" values.
//
//   Real field names (confirmed via datastore_search sample), NOT the
//   illustrative names in the task brief:
//     _id, Category, "Licence No.", "Operating Name", Issued, "Client Name",
//     "Business Phone", "Business Phone Ext.", "Licence Address Line 1",
//     "Licence Address Line 2", "Licence Address Line 3", Ward, Conditions,
//     "Free Form Conditions Line 1", "Free Form Conditions Line 2",
//     "Plate No.", Endorsements, "Cancel Date", "Last Record Update"
//
//   Notes on the fields this script relies on:
//     - Category: the licence class. Mapped via scripts/toronto-licence-mapping.ts;
//       see that file's header for what's excluded and why (no literal
//       "BARBER SHOP" / "VETERINARY" classes exist in the real data).
//     - Operating Name: the trade/display name (e.g. "A&W", "PIZZAIOLO").
//       Used as the business name — NOT "Client Name", which is the legal
//       entity/owner name and is not fit for public display.
//     - Licence Address Line 1: street address. Line 2 is "CITY, PROVINCE"
//       (e.g. "TORONTO, ON") — many rows are licensed businesses whose
//       address is outside Toronto (e.g. Mississauga), since this is a
//       *licensing* dataset, not a strict business-location index. We only
//       import rows whose Line 2 actually starts with "TORONTO", since we
//       hardcode city:"toronto" on every imported row.
//     - Cancel Date: null/absent for currently active licences; set (often
//       years in the past) for cancelled ones. The dataset contains a large
//       amount of historical/cancelled data going back to the early 2000s,
//       so this check is essential — most of the dataset is NOT a live
//       business.
//
// ---------------------------------------------------------------------
// Usage:
//   npx tsx scripts/import-toronto-businesses.ts [--dry-run] [--limit N]
//
//   --dry-run   Scans and evaluates rows exactly as a real run would
//               (including read-only DB slug-collision checks), but never
//               writes. Prints the licence-category histogram and mapping
//               coverage, plus what the run counters would have been.
//   --limit N   Maximum number of businesses to import+update this run.
//               Hard-capped at HARD_CAP regardless of what's passed (Global
//               Constraint); --limit can only LOWER it. Raised from 1,000 to
//               25,000 on Aug 3 2026 — see the constant for why.
//
// Approach: paginate the *unfiltered* datastore in batches of 1000, sorted
// by Issued desc (recent licences are far more likely to still be active,
// which keeps the skipped-inactive rate manageable while still giving a
// realistic, representative sample of the full category mix for the
// skipped-unmapped histogram). Stop once `limit` businesses have been
// imported/updated, the dataset is exhausted, or a safety scan bound is
// hit (to avoid a runaway scan if very few rows turn out to qualify).

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { makeBusinessSlug } from "@/lib/business-slug";
import { getBusinessCategory, getBusinessCategoryLabel, getBusinessSubcategoryLabel } from "@/lib/business-categories";
import { getCityLabel } from "@/lib/cities";
import { districtFromPostal } from "./toronto-districts";

/** The four districts a Toronto row can land in. */
const TORONTO_DISTRICT_SLUGS = ["toronto", "scarborough", "etobicoke", "north-york"];

/** Reported at the end of a run so the split is visible, not silent. */
const districtCounts = new Map<string, number>();
import { LICENCE_MAPPING } from "./toronto-licence-mapping";
import { cleanAddress, cleanName, isPlausibleStreetAddress, subcategoryFromName } from "./import-helpers";

const CKAN_BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/";
const RESOURCE_ID = "169e90ba-3ae0-43dd-8b2f-919e87002f50";
const BATCH_SIZE = 1000;
// Both ceilings raised Aug 3 2026 with the owner's approval. The originals
// (1,000 imports, 50,000 rows scanned) were Phase 5A rails from when this
// script was new and unproven — and they are why Toronto held only ~1,000
// businesses while York held 17,000, letting Markham appear to outrank a city
// ten times its size.
//
// The licence file carries 79,847 rows in categories we map, spread through
// the whole 159,459-row dataset, so the old scan ceiling could not reach them
// all however high the import cap went; both had to move together. Rows still
// collapse heavily on the way in: a business accumulates one licence row per
// renewal, and resolveSlug folds those back onto a single record.
const SAFETY_MAX_SCANNED = 200_000; // full dataset is ~159,459 rows
const HARD_CAP = 25_000; // Global Constraint — never exceed regardless of --limit
const WRITE_CHUNK = 250; // rows per createMany — matches the regional importer

interface TorontoRow {
  _id: number;
  Category: string | null;
  "Licence No.": string | null;
  "Operating Name": string | null;
  Issued: string | null;
  "Client Name": string | null;
  "Business Phone": string | null;
  "Licence Address Line 1": string | null;
  "Licence Address Line 2": string | null;
  "Licence Address Line 3": string | null;
  "Cancel Date": string | null;
}

interface DatastoreSearchResponse {
  success: boolean;
  result: {
    total: number;
    records: TorontoRow[];
  };
  error?: unknown;
}

// ---------------------------------------------------------------- CLI args

function parseArgs(argv: string[]) {
  let dryRun = false;
  let limit = HARD_CAP;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--limit") {
      const next = argv[i + 1];
      const n = Number(next);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
      i++;
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  // Hard cap regardless of what was requested.
  limit = Math.min(limit, HARD_CAP);
  return { dryRun, limit };
}

// ------------------------------------------------------------- CKAN fetch

async function datastoreSearch(offset: number, limit: number): Promise<DatastoreSearchResponse> {
  const url = new URL(CKAN_BASE + "datastore_search");
  url.searchParams.set("resource_id", RESOURCE_ID);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("sort", "Issued desc");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = (await res.json()) as DatastoreSearchResponse;
      if (!json.success) throw new Error(`CKAN error: ${JSON.stringify(json.error)}`);
      return json;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------ cleaning

/** Requires a street-number-led line 1 and a Toronto line 2 — guards against
 *  blank/placeholder addresses and out-of-city licensees (this dataset
 *  licenses some businesses located outside Toronto). */
function isPlausibleTorontoAddress(line1: string | null, line2: string | null): boolean {
  if (!isPlausibleStreetAddress(line1)) return false;
  if (!line2 || !/^TORONTO\b/i.test(line2.trim())) return false;
  return true;
}

// --------------------------------------------------------------- slugging

/** In-run memory of slugs already assigned, so duplicate licence rows for
 *  the same business (e.g. separate eating + take-out licences at one
 *  address) resolve back to the same slug instead of colliding. */
const runSlugToAddress = new Map<string, string>();

/**
 * Every existing Toronto slug, loaded ONCE at the start of a run.
 *
 * This used to be a findUnique per candidate slug. That was survivable while
 * the import cap was 1,000 rows, but at full scale it means tens of thousands
 * of round trips through the pgbouncer pool, and the run died partway with
 * P1017 "Server has closed the connection" — leaving Toronto half-imported.
 * The regional importer already resolves slugs in memory for exactly this
 * reason; this is that fix backported. One query, then pure map lookups.
 */
const existingSlugs = new Map<string, { address: string; source: string }>();

async function preloadExistingSlugs(): Promise<void> {
  const rows = await db.business.findMany({
    // All four Toronto districts, not just "toronto": a business moving from
    // toronto to scarborough changes its slug, and the collision check has to
    // see slugs across every district or it will happily mint a duplicate.
    where: { city: { in: TORONTO_DISTRICT_SLUGS } },
    select: { slug: true, address: true, source: true },
  });
  for (const r of rows) existingSlugs.set(r.slug, { address: r.address, source: r.source });
  console.log(`  preloaded ${rows.length} existing Toronto slugs`);
}

function resolveSlug(
  name: string,
  address: string,
  citySlug: string,
): { slug: string; isUpdate: boolean } {
  const base = makeBusinessSlug(name, citySlug);
  let candidate = base;
  let n = 2;

  for (;;) {
    const inRunAddress = runSlugToAddress.get(candidate);
    if (inRunAddress !== undefined) {
      if (inRunAddress.toLowerCase() === address.toLowerCase()) {
        return { slug: candidate, isUpdate: true }; // same business seen again this run
      }
      candidate = `${base}-${n++}`;
      continue;
    }

    const existing = existingSlugs.get(candidate);
    if (!existing) {
      runSlugToAddress.set(candidate, address);
      return { slug: candidate, isUpdate: false };
    }
    if (existing.source === "open-data" && existing.address.toLowerCase() === address.toLowerCase()) {
      runSlugToAddress.set(candidate, address);
      return { slug: candidate, isUpdate: true }; // same business from a prior run of this script
    }
    candidate = `${base}-${n++}`;
  }
}

// ----------------------------------------------------------------- main

interface Counters {
  scanned: number;
  imported: number;
  updated: number;
  skippedUnmapped: number;
  skippedInactive: number;
  skippedBadAddress: number;
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));

  console.log(`Toronto business import — ${dryRun ? "DRY RUN" : "LIVE RUN"}, limit=${limit}`);
  console.log("");

  await preloadExistingSlugs();
  console.log("");

  const counters: Counters = {
    scanned: 0,
    imported: 0,
    updated: 0,
    skippedUnmapped: 0,
    skippedInactive: 0,
    skippedBadAddress: 0,
  };

  // Writes are queued during the scan and flushed in chunks afterwards — see
  // the note at the queue sites.
  const pendingCreates: Prisma.BusinessCreateManyInput[] = [];
  const pendingUpdates: { slug: string; description: string; phone: string | null }[] = [];
  const categoryHistogram = new Map<string, number>();
  const mappedCategoryOutcomes = new Map<string, { imported: number; updated: number; skippedInactive: number; skippedBadAddress: number }>();

  let offset = 0;
  let datasetTotal = Infinity;
  const spotCheckSlugs: string[] = [];

  while (offset < datasetTotal && counters.scanned < SAFETY_MAX_SCANNED && counters.imported + counters.updated < limit) {
    const page = await datastoreSearch(offset, BATCH_SIZE);
    datasetTotal = page.result.total;
    const rows = page.result.records;
    if (rows.length === 0) break;

    for (const row of rows) {
      if (counters.imported + counters.updated >= limit) break;
      counters.scanned++;

      const category = (row.Category ?? "").trim();
      categoryHistogram.set(category, (categoryHistogram.get(category) ?? 0) + 1);

      const mapping = LICENCE_MAPPING[category];
      if (!mapping) {
        counters.skippedUnmapped++;
        continue;
      }

      const outcome = mappedCategoryOutcomes.get(category) ?? { imported: 0, updated: 0, skippedInactive: 0, skippedBadAddress: 0 };
      mappedCategoryOutcomes.set(category, outcome);

      if (row["Cancel Date"]) {
        counters.skippedInactive++;
        outcome.skippedInactive++;
        continue;
      }

      const line1 = row["Licence Address Line 1"];
      const line2 = row["Licence Address Line 2"];
      if (!isPlausibleTorontoAddress(line1, line2)) {
        counters.skippedBadAddress++;
        outcome.skippedBadAddress++;
        continue;
      }

      const operatingName = (row["Operating Name"] ?? "").trim();
      if (!operatingName) {
        counters.skippedBadAddress++; // no usable display name either — bucket with bad-address rejects
        outcome.skippedBadAddress++;
        continue;
      }

      const name = cleanName(operatingName);
      const address = cleanAddress(line1!);
      const categoryInfo = getBusinessCategory(mapping.category);
      if (!categoryInfo) {
        // Defensive: the mapping test already guarantees this can't happen,
        // but never write an unresolvable category.
        counters.skippedUnmapped++;
        continue;
      }
      // The licence class is evidence and wins; the name is inference and is
      // only consulted when the class said nothing. "EATING OR DRINKING
      // ESTABLISHMENT" covers a pizzeria and a tavern alike, which is why
      // 53% of restaurants had no subcategory at all.
      const subcategory =
        mapping.subcategory ?? subcategoryFromName(mapping.category, name);
      const subcategoryLabel = subcategory
        ? getBusinessSubcategoryLabel(mapping.category, subcategory)
        : null;
      const categoryLabel = getBusinessCategoryLabel(mapping.category);

      // Which part of Toronto. Amalgamation means every record here says
      // "TORONTO", but the postal code on line 3 gives the district exactly —
      // see scripts/toronto-districts.ts. Line 3 is populated on effectively
      // every row, and anything unreadable stays "toronto", which is always
      // literally true.
      const citySlug = districtFromPostal(row["Licence Address Line 3"]);
      const cityLabel = getCityLabel(citySlug);
      districtCounts.set(citySlug, (districtCounts.get(citySlug) ?? 0) + 1);

      const description = `${subcategoryLabel ?? categoryLabel} in ${cityLabel}. Licensed with the City of Toronto.`;
      const phone = row["Business Phone"]?.trim() || null;

      const { slug, isUpdate } = resolveSlug(name, address, citySlug);

      // Queued, not written here. Writing a row at a time inside the scan
      // loop is what killed the first full-scale run: thousands of sequential
      // single-row statements through pgbouncer and the pool drops with P1017
      // ("Server has closed the connection") partway through, leaving Toronto
      // half-imported. The regional importer collects candidates and writes
      // them in chunks for exactly this reason; this is that shape backported.
      if (!dryRun) {
        if (isUpdate) {
          pendingUpdates.push({ slug, description, phone });
        } else {
          pendingCreates.push({
            slug,
            name,
            description,
            category: mapping.category,
            subcategory,
            city: citySlug,
            address,
            phone,
            images: [],
            status: "active",
            source: "open-data",
            verified: false,
          });
        }
      }

      if (isUpdate) {
        counters.updated++;
        outcome.updated++;
      } else {
        counters.imported++;
        outcome.imported++;
      }
      if (spotCheckSlugs.length < 10) spotCheckSlugs.push(slug);
    }

    offset += rows.length;
  }

  // -------------------------------------------------------------- write
  //
  // Chunked, after the scan. skipDuplicates makes a re-run after an
  // interrupted one safe: rows already written are ignored rather than
  // exploding on the unique slug index, so this script stays resumable.
  if (!dryRun && (pendingCreates.length > 0 || pendingUpdates.length > 0)) {
    console.log("");
    for (let i = 0; i < pendingCreates.length; i += WRITE_CHUNK) {
      await db.business.createMany({
        data: pendingCreates.slice(i, i + WRITE_CHUNK),
        skipDuplicates: true,
      });
      process.stderr.write(
        `\r  created ${Math.min(i + WRITE_CHUNK, pendingCreates.length)}/${pendingCreates.length}`,
      );
    }
    if (pendingCreates.length) process.stderr.write("\n");

    // Updates cannot be batched into one statement (each row gets its own
    // description/phone), but they are far fewer than creates and are the
    // rows that already exist.
    for (const [i, u] of pendingUpdates.entries()) {
      await db.business.update({
        where: { slug: u.slug },
        data: { description: u.description, ...(u.phone ? { phone: u.phone } : {}) },
      });
      if (i % 250 === 0) process.stderr.write(`\r  updated ${i}/${pendingUpdates.length}`);
    }
    if (pendingUpdates.length) process.stderr.write(`\r  updated ${pendingUpdates.length}/${pendingUpdates.length}\n`);
  }

  // ------------------------------------------------------------- report

  console.log(`Scanned ${counters.scanned} licence rows (dataset total: ${datasetTotal}).`);
  console.log("");
  console.log("Licence-category histogram (rows scanned this run):");
  const sortedHistogram = [...categoryHistogram.entries()].sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedHistogram) {
    const mapped = LICENCE_MAPPING[cat] ? "MAPPED" : "unmapped";
    console.log(`  ${String(count).padStart(6)}  ${mapped.padEnd(8)}  ${cat}`);
  }
  console.log("");
  console.log("Mapping coverage:");
  const mappedRows = counters.scanned - counters.skippedUnmapped;
  console.log(`  ${mappedRows}/${counters.scanned} scanned rows (${((mappedRows / Math.max(counters.scanned, 1)) * 100).toFixed(1)}%) had a mapped licence category.`);
  console.log("");
  console.log("Outcome by mapped category:");
  for (const [cat, o] of [...mappedCategoryOutcomes.entries()].sort((a, b) => b[1].imported + b[1].updated - (a[1].imported + a[1].updated))) {
    console.log(`  ${cat}: imported=${o.imported} updated=${o.updated} skipped-inactive=${o.skippedInactive} skipped-bad-address=${o.skippedBadAddress}`);
  }
  console.log("");
  console.log("Per Toronto district (from postal FSA):");
  for (const [d, n] of [...districtCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d.padEnd(12)} ${n}`);
  }
  console.log("");

  console.log("Counters:");
  console.log(`  imported:            ${counters.imported}`);
  console.log(`  updated:             ${counters.updated}`);
  console.log(`  skipped-unmapped:    ${counters.skippedUnmapped}`);
  console.log(`  skipped-inactive:    ${counters.skippedInactive}`);
  console.log(`  skipped-bad-address: ${counters.skippedBadAddress}`);
  if (dryRun) {
    console.log("");
    console.log("DRY RUN — no rows were written.");
  } else {
    console.log("");
    console.log(`Spot-check slugs (first ${spotCheckSlugs.length}): ${spotCheckSlugs.join(", ")}`);
  }
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
