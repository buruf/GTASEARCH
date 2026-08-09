// Toronto Public Health open-data import — directory curation batch 2.
//
// Fills two categories the Phase 5A licence import could not fill honestly:
//   beauty     <- BodySafe (personal service settings: hair, nails, tattoo…)
//   education  <- ChildCareSafe (licensed child care centres)
//
// ---------------------------------------------------------------------
// Datasets (confirmed live 2026-08-02, via CKAN datastore_search):
//   BodySafe        package "bodysafe"
//                   resource 315f0f9f-cbf0-4b95-b8a5-a4afda0f4ff5
//                   13,194 inspection rows / 3,692 distinct establishments
//                   fields: estId, estName, addrFull, srvType, insStatus,
//                           insDate, observation, infCategory, defDesc,
//                           infType, actionDesc, OutcomeDate, OutcomeDesc,
//                           fineAmount, geometry
//   ChildCareSafe   package "childcaresafe"
//                   resource b9a61769-34f5-4329-983a-bd179a301a21
//                   2,599 inspection rows
//                   fields: "Establishment Name", "Establishment Address",
//                           "Establishment ID", "Inspection Date",
//                           "Inspection Status", Observation, "Infraction
//                           Category", "Infraction Details", Severity,
//                           Action, geometry
//
// Both are INSPECTION feeds: one row per inspection, many rows per premises.
// We reduce to one row per establishment id, keeping the most recent
// inspection date and the union of service types seen.
//
// We import ONLY name, address and service type. Inspection outcomes,
// infractions, severities and fines are never read into the directory — see
// scripts/toronto-health-mapping.ts for why.
//
// FRESHNESS: an establishment is imported only if its most recent inspection
// falls inside --months (default 24). These feeds retain premises that have
// since closed; recent inspection is the only "still trading" signal the data
// offers. At the default window this admits ~3,000 of 3,692 BodySafe rows.
//
// ---------------------------------------------------------------------
// Usage:
//   npx tsx scripts/import-toronto-health-services.ts [--dry-run]
//        [--limit N] [--months N] [--source bodysafe|childcare|all]
//
//   --dry-run   Evaluates every row exactly as a live run would, including
//               slug resolution against the real DB, but writes nothing.
//   --limit N   Max establishments written this run (hard cap 4000).
//   --months N  Freshness window in months (default 24).
//   --source    Which feed(s) to run. Default: all.
//
// Idempotent: re-running upserts by slug, so an interrupted run can simply be
// run again.

import "dotenv/config";
import { db } from "@/lib/db";
import { makeBusinessSlug } from "@/lib/business-slug";
import {
  getBusinessCategory,
  getBusinessCategoryLabel,
  getBusinessSubcategoryLabel,
} from "@/lib/business-categories";
import {
  BODYSAFE_SERVICE_MAPPING,
  CHILDCARE_MAPPING,
  pickPrimaryServiceType,
  refineSubcategory,
} from "./toronto-health-mapping";
import { cleanAddress, cleanName, isPlausibleStreetAddress } from "./import-helpers";
import { getCityLabel } from "@/lib/cities";
import {
  districtFromPoint,
  loadWardPolygons,
  type WardPolygon,
} from "./toronto-districts";

/** Reported at the end of a run so the district split is visible, not silent. */
const districtCounts = new Map<string, number>();

const CKAN_BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/";
const BODYSAFE_RESOURCE = "315f0f9f-cbf0-4b95-b8a5-a4afda0f4ff5";
const CHILDCARE_RESOURCE = "b9a61769-34f5-4329-983a-bd179a301a21";
const PAGE_SIZE = 1000;
const HARD_CAP = 6000; // covers both feeds in full (~4,400 qualifying premises)
const WRITE_CHUNK = 250;

type SourceName = "bodysafe" | "childcare";

/** One establishment, reduced from many inspection rows. */
interface Establishment {
  id: string;
  name: string;
  address: string;
  lastInspection: string; // ISO date
  serviceTypes: Set<string>;
  /** [lng, lat] from the feed's GeoJSON, used to place the row in one of
   *  Toronto's four districts. These feeds carry no postal code, so the
   *  point is the only district evidence they offer. */
  point: [number, number] | null;
}

interface Candidate {
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory: string | null;
  address: string;
  city: string;
  isUpdate: boolean;
  source: SourceName;
}

// ---------------------------------------------------------------- CLI args

function parseArgs(argv: string[]) {
  let dryRun = false;
  let limit = HARD_CAP;
  let months = 24;
  let sources: SourceName[] = ["bodysafe", "childcare"];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readNumber = (inline: string) => {
      if (arg.startsWith(inline + "=")) return Number(arg.slice(inline.length + 1));
      const n = Number(argv[i + 1]);
      i++;
      return n;
    };
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--limit" || arg.startsWith("--limit=")) {
      const n = readNumber("--limit");
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (arg === "--months" || arg.startsWith("--months=")) {
      const n = readNumber("--months");
      if (Number.isFinite(n) && n > 0) months = Math.floor(n);
    } else if (arg === "--source" || arg.startsWith("--source=")) {
      const raw = arg.startsWith("--source=") ? arg.slice("--source=".length) : argv[++i];
      if (raw === "bodysafe" || raw === "childcare") sources = [raw];
      else if (raw !== "all") throw new Error(`unknown --source "${raw}"`);
    }
  }

  return { dryRun, limit: Math.min(limit, HARD_CAP), months, sources };
}

// ------------------------------------------------------------- CKAN fetch

async function fetchPage(resourceId: string, offset: number) {
  const url = new URL(CKAN_BASE + "datastore_search");
  url.searchParams.set("resource_id", resourceId);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = (await res.json()) as {
        success: boolean;
        result: { total: number; records: Record<string, unknown>[] };
        error?: unknown;
      };
      if (!json.success) throw new Error(`CKAN error: ${JSON.stringify(json.error)}`);
      return json.result;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw lastErr;
}

/** Pages a whole inspection feed and reduces it to one entry per premises. */
async function loadEstablishments(
  resourceId: string,
  fields: { id: string; name: string; address: string; date: string; service?: string },
): Promise<Establishment[]> {
  const byId = new Map<string, Establishment>();
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const page = await fetchPage(resourceId, offset);
    total = page.total;
    if (page.records.length === 0) break;

    for (const row of page.records) {
      const id = String(row[fields.id] ?? "").trim();
      const name = String(row[fields.name] ?? "").trim();
      const address = String(row[fields.address] ?? "").trim();
      const date = String(row[fields.date] ?? "").trim();
      if (!id || !name) continue;

      // GeoJSON arrives as a JSON string; a missing or malformed one simply
      // leaves the row to fall back to "toronto" later.
      let point: [number, number] | null = null;
      const rawGeo = row["geometry"];
      if (rawGeo) {
        try {
          const geo = JSON.parse(String(rawGeo)) as { coordinates?: number[] };
          if (Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
            point = [geo.coordinates[0], geo.coordinates[1]];
          }
        } catch {
          /* leave null */
        }
      }

      const existing = byId.get(id);
      if (existing) {
        if (date > existing.lastInspection) {
          existing.lastInspection = date;
          existing.name = name;
          existing.address = address;
          if (point) existing.point = point;
        }
      } else {
        byId.set(id, { id, name, address, lastInspection: date, serviceTypes: new Set(), point });
      }

      if (fields.service) {
        const svc = String(row[fields.service] ?? "").trim();
        if (svc) byId.get(id)!.serviceTypes.add(svc);
      }
    }

    offset += page.records.length;
    process.stderr.write(`\r  fetched ${Math.min(offset, total)}/${total}`);
  }
  process.stderr.write("\n");

  return [...byId.values()];
}

// --------------------------------------------------------------- slugging

/**
 * Pre-loads every existing slug once instead of issuing a findUnique per row —
 * this batch is thousands of rows, and the per-row round trip is what made the
 * Phase 5A import slow enough to hit a tool timeout.
 */
async function loadExistingSlugs() {
  const rows = await db.business.findMany({
    select: { slug: true, address: true, source: true, category: true },
  });
  return new Map(
    rows.map((r) => [r.slug, { address: r.address, source: r.source, category: r.category }]),
  );
}

function resolveSlug(
  name: string,
  address: string,
  citySlug: string,
  existing: Map<string, { address: string; source: string; category: string }>,
  claimedThisRun: Map<string, string>,
): { slug: string; isUpdate: boolean; priorCategory: string | null } {
  const base = makeBusinessSlug(name, citySlug);
  let candidate = base;
  let n = 2;

  for (;;) {
    const claimed = claimedThisRun.get(candidate);
    if (claimed !== undefined) {
      // Same premises seen twice this run (duplicate establishment ids do
      // occur across service streams) — fold back onto the one slug.
      if (claimed.toLowerCase() === address.toLowerCase())
        return { slug: candidate, isUpdate: true, priorCategory: null };
      candidate = `${base}-${n++}`;
      continue;
    }

    const prior = existing.get(candidate);
    if (!prior) {
      claimedThisRun.set(candidate, address);
      return { slug: candidate, isUpdate: false, priorCategory: null };
    }
    if (prior.source === "open-data" && prior.address.toLowerCase() === address.toLowerCase()) {
      claimedThisRun.set(candidate, address);
      // Same business from an earlier run/feed.
      return { slug: candidate, isUpdate: true, priorCategory: prior.category };
    }
    candidate = `${base}-${n++}`;
  }
}

/**
 * Some premises hold licences in two worlds at once — 821 Gerrard St E is
 * registered as BOTH a personal service setting and an eating/drinking
 * establishment, and both licences are live. When a later feed lands on a row
 * an earlier feed already categorised, we refuse to silently re-file it: the
 * conflict is reported and the existing category is left alone. Re-categorising
 * thousands of rows on the say-so of whichever import ran last is exactly the
 * kind of unreviewed churn that makes a directory untrustworthy.
 */
function isCategoryConflict(priorCategory: string | null, newCategory: string): boolean {
  return priorCategory !== null && priorCategory !== newCategory;
}

// ------------------------------------------------------------------ main

async function main() {
  const { dryRun, limit, months, sources } = parseArgs(process.argv.slice(2));

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  console.log(
    `Toronto Public Health import — ${dryRun ? "DRY RUN" : "LIVE RUN"}, limit=${limit}, ` +
      `freshness=${months}mo (inspected on/after ${cutoff}), sources=${sources.join("+")}`,
  );
  console.log("");

  const counters = {
    establishments: 0,
    imported: 0,
    updated: 0,
    skippedStale: 0,
    skippedBadAddress: 0,
    skippedUnmapped: 0,
    skippedOverLimit: 0,
    skippedConflict: 0,
  };
  const conflicts: string[] = [];
  const subcategoryHistogram = new Map<string, number>();
  const perSource = new Map<SourceName, number>();

  const existing = await loadExistingSlugs();
  const claimedThisRun = new Map<string, string>();
  const candidates: Candidate[] = [];

  // Toronto's 25 ward boundaries, fetched once. These feeds have no postal
  // code, so coordinates are the only district evidence — see
  // scripts/toronto-districts.ts.
  const wardPolygons: WardPolygon[] = await loadWardPolygons();
  console.log(`Loaded ${wardPolygons.length} ward boundaries for district lookup`);

  for (const source of sources) {
    console.log(`Loading ${source}…`);
    const establishments =
      source === "bodysafe"
        ? await loadEstablishments(BODYSAFE_RESOURCE, {
            id: "estId",
            name: "estName",
            address: "addrFull",
            date: "insDate",
            service: "srvType",
          })
        : await loadEstablishments(CHILDCARE_RESOURCE, {
            id: "Establishment ID",
            name: "Establishment Name",
            address: "Establishment Address",
            date: "Inspection Date",
          });

    console.log(`  ${establishments.length} distinct establishments`);
    counters.establishments += establishments.length;

    for (const est of establishments) {
      if (est.lastInspection < cutoff) {
        counters.skippedStale++;
        continue;
      }
      if (!isPlausibleStreetAddress(est.address)) {
        counters.skippedBadAddress++;
        continue;
      }

      let category: string;
      let subcategory: string | null;

      if (source === "bodysafe") {
        const primary = pickPrimaryServiceType(est.serviceTypes);
        const mapping = primary ? BODYSAFE_SERVICE_MAPPING[primary] : undefined;
        if (!mapping) {
          // Unknown/absent service type — never guess a category.
          counters.skippedUnmapped++;
          continue;
        }
        category = mapping.category;
        subcategory = refineSubcategory(est.name, primary);
      } else {
        category = CHILDCARE_MAPPING.category;
        subcategory = CHILDCARE_MAPPING.subcategory ?? null;
      }

      const categoryInfo = getBusinessCategory(category);
      if (!categoryInfo) {
        counters.skippedUnmapped++;
        continue;
      }

      if (counters.imported + counters.updated + candidates.length >= limit) {
        counters.skippedOverLimit++;
        continue;
      }

      const name = cleanName(est.name);
      const address = cleanAddress(est.address);
      const subLabel = subcategory ? getBusinessSubcategoryLabel(category, subcategory) : null;
      const what =
        subLabel ??
        (source === "bodysafe" ? "Personal service setting" : getBusinessCategoryLabel(category));

      // Which part of Toronto. These feeds carry no postal code, so the
      // district comes from the establishment's coordinates via the City's
      // ward boundaries — see scripts/toronto-districts.ts. A row with no
      // usable point, or one that falls outside every ward, stays "toronto",
      // which is always literally true.
      const citySlug =
        (est.point && districtFromPoint(est.point[0], est.point[1], wardPolygons)) || "toronto";
      districtCounts.set(citySlug, (districtCounts.get(citySlug) ?? 0) + 1);

      const description = `${what} in ${getCityLabel(citySlug)}. Inspected by Toronto Public Health.`;

      const { slug, isUpdate, priorCategory } = resolveSlug(name, address, citySlug, existing, claimedThisRun);
      if (isCategoryConflict(priorCategory, category)) {
        counters.skippedConflict++;
        conflicts.push(`${slug}: kept "${priorCategory}", ${source} proposed "${category}"`);
        continue;
      }
      candidates.push({ slug, name, description, category, subcategory, address, city: citySlug, isUpdate, source });

      const key = `${category}/${subcategory ?? "(none)"}`;
      subcategoryHistogram.set(key, (subcategoryHistogram.get(key) ?? 0) + 1);
      perSource.set(source, (perSource.get(source) ?? 0) + 1);
    }
  }

  // ------------------------------------------------------------- write

  const creates = candidates.filter((c) => !c.isUpdate);
  const updates = candidates.filter((c) => c.isUpdate);

  if (!dryRun) {
    for (let i = 0; i < creates.length; i += WRITE_CHUNK) {
      const chunk = creates.slice(i, i + WRITE_CHUNK);
      await db.business.createMany({
        data: chunk.map((c) => ({
          slug: c.slug,
          name: c.name,
          description: c.description,
          category: c.category,
          subcategory: c.subcategory,
          city: c.city,
          address: c.address,
          phone: null,
          images: [],
          status: "active",
          source: "open-data",
          verified: false,
        })),
        skipDuplicates: true,
      });
      process.stderr.write(`\r  created ${Math.min(i + WRITE_CHUNK, creates.length)}/${creates.length}`);
    }
    if (creates.length) process.stderr.write("\n");

    for (const u of updates) {
      await db.business.update({
        where: { slug: u.slug },
        // Category is intentionally absent: conflicts were filtered out
        // above, so it already matches, and never writing it keeps the
        // "a later feed cannot re-file an existing row" rule enforced here
        // too, not just at the conflict check.
        data: { description: u.description, subcategory: u.subcategory },
      });
    }
  }

  counters.imported = creates.length;
  counters.updated = updates.length;

  // ------------------------------------------------------------ report

  console.log("");
  console.log("Category / subcategory breakdown:");
  for (const [key, n] of [...subcategoryHistogram].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${key}`);
  }
  console.log("");
  console.log("Per source:");
  for (const [s, n] of perSource) console.log(`  ${s}: ${n}`);
  console.log("");
  console.log("Per Toronto district (from ward polygons):");
  for (const [d, n] of [...districtCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${d.padEnd(12)} ${n}`);
  }
  console.log("");

  console.log("Counters:");
  console.log(`  establishments seen:  ${counters.establishments}`);
  console.log(`  imported (new):       ${counters.imported}`);
  console.log(`  updated (existing):   ${counters.updated}`);
  console.log(`  skipped-stale:        ${counters.skippedStale}`);
  console.log(`  skipped-bad-address:  ${counters.skippedBadAddress}`);
  console.log(`  skipped-unmapped:     ${counters.skippedUnmapped}`);
  console.log(`  skipped-over-limit:   ${counters.skippedOverLimit}`);
  console.log(`  skipped-conflict:     ${counters.skippedConflict}`);
  if (conflicts.length) {
    console.log("\nCategory conflicts left untouched (existing category kept):");
    for (const c of conflicts.slice(0, 20)) console.log(`  ${c}`);
  }

  if (dryRun) {
    console.log("");
    console.log("DRY RUN — nothing written. Sample of what would be created:");
    for (const c of creates.slice(0, 12)) {
      console.log(`  ${c.slug}`);
      console.log(`     ${c.name} — ${c.category}/${c.subcategory ?? "(none)"} — ${c.address}`);
    }
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
