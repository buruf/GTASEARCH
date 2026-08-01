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
//               Hard-capped at 1000 regardless of what's passed (Global
//               Constraint) — this is a first-batch import, not a bulk load.
//
// Approach: paginate the *unfiltered* datastore in batches of 1000, sorted
// by Issued desc (recent licences are far more likely to still be active,
// which keeps the skipped-inactive rate manageable while still giving a
// realistic, representative sample of the full category mix for the
// skipped-unmapped histogram). Stop once `limit` businesses have been
// imported/updated, the dataset is exhausted, or a safety scan bound is
// hit (to avoid a runaway scan if very few rows turn out to qualify).

import "dotenv/config";
import { db } from "@/lib/db";
import { makeBusinessSlug } from "@/lib/business-slug";
import { getBusinessCategory, getBusinessCategoryLabel, getBusinessSubcategoryLabel } from "@/lib/business-categories";
import { LICENCE_MAPPING } from "./toronto-licence-mapping";

const CKAN_BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/";
const RESOURCE_ID = "169e90ba-3ae0-43dd-8b2f-919e87002f50";
const BATCH_SIZE = 1000;
const SAFETY_MAX_SCANNED = 50_000; // stop scanning even if under `limit`
const HARD_CAP = 1000; // Global Constraint — never exceed regardless of --limit

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

/** Trailing corporate suffixes stripped for display, e.g. "FOO BAR LTD" -> "FOO BAR". */
const CORP_SUFFIX_RE = /[\s,]+(LTD|LIMITED|INC|INCORPORATED|CORP|CORPORATION)\.?$/i;

function stripCorporateSuffix(raw: string): string {
  let name = raw.trim();
  // Loop in case of stacked suffixes ("... INC LTD").
  let prev: string;
  do {
    prev = name;
    name = name.replace(CORP_SUFFIX_RE, "").trim();
  } while (name !== prev && name.length > 0);
  return name || raw.trim();
}

/** Title-cases a name while leaving punctuation-adjacent letters (e.g. "A&W") capitalized too. */
function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s\-/&(])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function cleanName(operatingName: string): string {
  return titleCase(stripCorporateSuffix(operatingName));
}

/** Requires a street-number-led line 1 and a Toronto line 2 — guards against
 *  blank/placeholder addresses and out-of-city licensees (this dataset
 *  licenses some businesses located outside Toronto). */
function isPlausibleTorontoAddress(line1: string | null, line2: string | null): boolean {
  if (!line1 || !line2) return false;
  const l1 = line1.trim();
  const l2 = line2.trim();
  if (l1.length < 5) return false;
  if (!/^\d+[a-zA-Z0-9]*\s+\S/.test(l1)) return false; // starts with a street number
  if (!/^TORONTO\b/i.test(l2)) return false;
  return true;
}

function cleanAddress(line1: string): string {
  return line1.trim().replace(/\s+/g, " ");
}

// --------------------------------------------------------------- slugging

/** In-run memory of slugs already assigned, so duplicate licence rows for
 *  the same business (e.g. separate eating + take-out licences at one
 *  address) resolve back to the same slug instead of colliding. */
const runSlugToAddress = new Map<string, string>();

async function resolveSlug(name: string, address: string, dryRun: boolean): Promise<{ slug: string; isUpdate: boolean }> {
  const base = makeBusinessSlug(name, "toronto");
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

    // Not seen yet this run — check the DB (read-only; safe under --dry-run).
    const existing = await db.business.findUnique({
      where: { slug: candidate },
      select: { address: true, source: true },
    });
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

  const counters: Counters = {
    scanned: 0,
    imported: 0,
    updated: 0,
    skippedUnmapped: 0,
    skippedInactive: 0,
    skippedBadAddress: 0,
  };
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
      const subcategoryLabel = mapping.subcategory ? getBusinessSubcategoryLabel(mapping.category, mapping.subcategory) : null;
      const categoryLabel = getBusinessCategoryLabel(mapping.category);
      const description = `${subcategoryLabel ?? categoryLabel} in Toronto. Licensed with the City of Toronto.`;
      const phone = row["Business Phone"]?.trim() || null;

      const { slug, isUpdate } = await resolveSlug(name, address, dryRun);

      if (!dryRun) {
        if (isUpdate) {
          await db.business.update({
            where: { slug },
            data: {
              description,
              ...(phone ? { phone } : {}),
            },
          });
        } else {
          await db.business.create({
            data: {
              slug,
              name,
              description,
              category: mapping.category,
              subcategory: mapping.subcategory ?? null,
              city: "toronto",
              address,
              phone,
              images: [],
              status: "active",
              source: "open-data",
              verified: false,
            },
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
