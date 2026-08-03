// Multi-city GTA business-directory import (curation batch 3).
//
// Toronto's feeds only ever covered Toronto, which left the directory a
// one-city product. Every other GTA region publishes a NAICS-coded business
// directory through an ArcGIS Open Data portal, so one importer with a small
// per-source adapter covers them all.
//
// ---------------------------------------------------------------------
// Sources (verified live 2026-08-03) and their licences — the licence is why
// only these two are enabled so far:
//
//   Mississauga  "2025 Mississauga Business Directory", 14,637 records
//                services6.arcgis.com/hM5ymMLbxIyWTjn2/.../2025_Mississauga_Business_Directory/FeatureServer/0
//                Licence: City of Mississauga Terms of Use — grants a
//                "world-wide, royalty-free, non-exclusive, revocable licence
//                to use, modify, and distribute the Datasets ... for any
//                lawful purpose", conditional on passing the Terms URL along
//                with any redistribution. Surfaced on /data-sources.
//
//   Brampton     "Brampton Business Directory", 6,126 records
//                services3.arcgis.com/rl7ACuZkiFsmDA2g/.../Economic_Development/FeatureServer/0
//                Licence: CC BY 4.0 — commercial use with attribution.
//                Attribution on /data-sources.
//
// NOT YET ENABLED, licence unverified: York Region "Business Directory 2024"
// (33,626 records, by far the biggest prize — Markham, Vaughan, Richmond
// Hill, Aurora, Newmarket) points at a "York Region Open Data Licence" that is
// only findable by searching their portal; Durham Region "Business Directory"
// (6,874) links a licence PDF that currently 404s. Both are wired as adapters
// below but left out of DEFAULT_SOURCES until their terms are read. Do not
// enable them by editing this list alone.
//
// ---------------------------------------------------------------------
// Usage:
//   npx tsx scripts/import-gta-directories.ts [--dry-run] [--limit N]
//        [--source mississauga|brampton|all]

import "dotenv/config";
import { db } from "@/lib/db";
import { makeBusinessSlug } from "@/lib/business-slug";
import {
  getBusinessCategory,
  getBusinessCategoryLabel,
  getBusinessSubcategoryLabel,
} from "@/lib/business-categories";
import { CITIES } from "@/lib/cities";
import {
  HOME_BASED_RISK,
  PREMISES_CATEGORIES,
  hasCommercialSignal,
  hasUnitDesignator,
  lookupNaics,
  looksLikePersonalName,
  looksResidential,
} from "./naics-mapping";
import {
  cleanAddress,
  cleanName,
  isPlausibleStreetAddress,
  normalizeWebsite,
  repairMojibake,
} from "./import-helpers";

const PAGE_SIZE = 1000;
const HARD_CAP = 12_000;
const WRITE_CHUNK = 250;

/** Normalised record, whatever the source portal called its columns. */
interface Raw {
  name: string;
  address: string;
  city: string;
  naics: string | number | null;
  phone: string | null;
  website: string | null;
  employees: string | null;
}

interface SourceAdapter {
  key: string;
  label: string;
  /** Attribution line shown on /data-sources. */
  attribution: string;
  url: string;
  /** Fixed city slug, or null when the record carries its own municipality. */
  citySlug: string | null;
  map: (a: Record<string, unknown>) => Raw;
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const SOURCES: SourceAdapter[] = [
  {
    key: "mississauga",
    label: "City of Mississauga Business Directory (2025)",
    attribution: "City of Mississauga — Terms of Use",
    url: "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/2025_Mississauga_Business_Directory/FeatureServer/0",
    citySlug: "mississauga",
    map: (a) => ({
      name: str(a.BusinessName) ?? "",
      // StreetAddress is the street line; UnitNo is separate.
      address: [str(a.StreetAddress), str(a.UnitNo) ? `Unit ${str(a.UnitNo)}` : null]
        .filter(Boolean)
        .join(", "),
      city: "mississauga",
      naics: (a.NAICSCode as string | number | null) ?? null,
      phone: str(a.BusinessPhone),
      website: str(a.WebAddress),
      employees: str(a.EmplRange),
    }),
  },
  {
    key: "brampton",
    label: "City of Brampton Business Directory",
    attribution: "City of Brampton — CC BY 4.0",
    url: "https://services3.arcgis.com/rl7ACuZkiFsmDA2g/arcgis/rest/services/Economic_Development/FeatureServer/0",
    citySlug: "brampton",
    map: (a) => ({
      name: str(a.COMPANY_NAME) ?? "",
      address: str(a.BUSINESS_FULL_ADDRESS) ?? "",
      city: "brampton",
      naics: (a.NAICS_DETAIL as string | number | null) ?? null,
      phone: str(a.PHONE),
      website: str(a.WEBURL),
      employees: str(a.TOTAL_EMPLOYEE_GROUPED),
    }),
  },
  {
    key: "york",
    label: "York Region Business Directory (2024)",
    attribution:
      "Contains public sector information made available under The Regional Municipality of York's Open Data Licence",
    url: "https://services1.arcgis.com/GzvOwaQBbX7KLiuG/arcgis/rest/services/Business_Directory_2024/FeatureServer/1",
    // Regional feed: nine municipalities, so the city comes off each record.
    citySlug: null,
    map: (a) => ({
      name: str(a.NAME) ?? "",
      address: [str(a.FULL_ADDRESS), str(a.UNIT_NUM) ? `Unit ${str(a.UNIT_NUM)}` : null]
        .filter(Boolean)
        .join(", "),
      city: (str(a.MUNICIPALITY) ?? "").toLowerCase().replace(/\s+/g, "-"),
      naics: (a.PRIM_NAICS as string | number | null) ?? null,
      phone: str(a.PHONE_NO),
      website: str(a.WEBSITE),
      employees: str(a.EMPLOYEE_RANGE),
    }),
  },
  {
    key: "durham",
    label: "Durham Region Business Directory",
    attribution:
      "Contains public sector information made available under The Regional Municipality of Durham's Open Data Licence",
    url: "https://maps.durham.ca/arcgis/rest/services/Open_Data/Durham_OpenData/MapServer/11",
    citySlug: null,
    map: (a) => ({
      name: str(a.Business_Name) ?? "",
      // Durham stores the address in parts rather than one line.
      address: [
        [str(a.Street_Number), str(a.Street_Name), str(a.Street_Type), str(a.Street_Direction)]
          .filter(Boolean)
          .join(" "),
        str(a.Unit_Number) ? `Unit ${str(a.Unit_Number)}` : null,
      ]
        .filter(Boolean)
        .join(", "),
      city: (str(a.Municipality) ?? "").toLowerCase().replace(/\s+/g, "-"),
      naics: (a.NAICSCode as string | number | null) ?? null,
      phone: str(a.Telephone_Number),
      website: str(a.Web_Address),
      // Durham publishes no employee-count field, so home-based-risk trades
      // here qualify on a published website alone.
      employees: null,
    }),
  },
];

/**
 * Only sources whose licence text has actually been read run by default.
 * All four are the same UK-OGL-derived family: worldwide, royalty-free,
 * explicitly permitting commercial use and derivative works, with attribution
 * encouraged (York, Durham) or required (Brampton, CC BY 4.0). Every one is
 * credited on /data-sources.
 */
const DEFAULT_SOURCES = ["mississauga", "brampton", "york", "durham"];

const CITY_SLUGS = new Set(CITIES.map((c) => c.slug));

// ---------------------------------------------------------------- CLI args

function parseArgs(argv: string[]) {
  let dryRun = false;
  let limit = HARD_CAP;
  let keys = DEFAULT_SOURCES;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--limit" || arg.startsWith("--limit=")) {
      const n = Number(arg.startsWith("--limit=") ? arg.slice(8) : argv[++i]);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (arg === "--source" || arg.startsWith("--source=")) {
      const raw = arg.startsWith("--source=") ? arg.slice(9) : argv[++i];
      if (raw !== "all") {
        if (!SOURCES.some((s) => s.key === raw)) throw new Error(`unknown --source "${raw}"`);
        keys = [raw];
      }
    }
  }
  return { dryRun, limit: Math.min(limit, HARD_CAP), keys };
}

// ---------------------------------------------------------- ArcGIS fetch

async function fetchAll(url: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  for (;;) {
    const q = new URL(`${url}/query`);
    q.searchParams.set("where", "1=1");
    q.searchParams.set("outFields", "*");
    q.searchParams.set("returnGeometry", "false");
    q.searchParams.set("resultOffset", String(offset));
    q.searchParams.set("resultRecordCount", String(PAGE_SIZE));
    q.searchParams.set("f", "json");

    let page: { features?: { attributes: Record<string, unknown> }[]; error?: unknown } | null = null;
    for (let attempt = 1; attempt <= 3 && !page; attempt++) {
      try {
        const res = await fetch(q.toString(), { signal: AbortSignal.timeout(45_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        page = await res.json();
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    if (page?.error) throw new Error(`ArcGIS error: ${JSON.stringify(page.error)}`);
    const feats = page?.features ?? [];
    if (feats.length === 0) break;
    for (const f of feats) out.push(f.attributes);
    offset += feats.length;
    process.stderr.write(`\r  fetched ${out.length}`);
    if (feats.length < PAGE_SIZE) break;
  }
  process.stderr.write("\n");
  return out;
}

// ------------------------------------------------------------------ main

async function main() {
  const { dryRun, limit, keys } = parseArgs(process.argv.slice(2));
  console.log(
    `GTA regional directory import — ${dryRun ? "DRY RUN" : "LIVE RUN"}, limit=${limit}, sources=${keys.join("+")}`,
  );

  const counters = {
    scanned: 0,
    imported: 0,
    updated: 0,
    skippedUnmapped: 0,
    skippedBadAddress: 0,
    skippedHomeBased: 0,
    skippedPersonalName: 0,
    skippedConflict: 0,
    skippedOverLimit: 0,
    skippedUnknownCity: 0,
  };
  const unknownCities = new Map<string, number>();
  const histogram = new Map<string, number>();
  const perCity = new Map<string, number>();

  const existingRows = await db.business.findMany({
    select: { slug: true, address: true, source: true, category: true },
  });
  const existing = new Map(
    existingRows.map((r) => [r.slug, { address: r.address, source: r.source, category: r.category }]),
  );
  const claimed = new Map<string, string>();

  interface Candidate {
    slug: string; name: string; description: string; category: string;
    subcategory: string | null; city: string; address: string;
    phone: string | null; website: string | null; isUpdate: boolean;
  }
  const candidates: Candidate[] = [];

  for (const key of keys) {
    const source = SOURCES.find((s) => s.key === key)!;
    console.log(`\nLoading ${source.label}…`);
    const rows = await fetchAll(source.url);
    console.log(`  ${rows.length} records`);

    for (const attrs of rows) {
      counters.scanned++;
      const raw = source.map(attrs);
      if (!raw.name) continue;

      const mapping = lookupNaics(raw.naics);
      if (!mapping) {
        counters.skippedUnmapped++;
        continue;
      }
      const categoryInfo = getBusinessCategory(mapping.category);
      if (!categoryInfo) {
        counters.skippedUnmapped++;
        continue;
      }

      if (!isPlausibleStreetAddress(raw.address)) {
        counters.skippedBadAddress++;
        continue;
      }

      // Privacy gates. Two ways a record can really be a private individual
      // at home: a trade licensed to a sole operator, or a sole proprietor
      // registered under their own personal name. Both need corroborating
      // evidence of commercial premises before we publish an address.
      const naicsDigits = String(raw.naics ?? "").replace(/\D/g, "");
      const personalName =
        !PREMISES_CATEGORIES.has(mapping.category) && looksLikePersonalName(raw.name);
      if (personalName) {
        // A person's name is only withheld when nothing else says "premises":
        // no website, and no unit/suite number in the address.
        const premises =
          hasCommercialSignal(raw.website, raw.employees) || hasUnitDesignator(raw.address);
        if (!premises || looksResidential(raw.address)) {
          counters.skippedPersonalName++;
          continue;
        }
      }
      if (HOME_BASED_RISK.has(naicsDigits)) {
        const ok = hasCommercialSignal(raw.website, raw.employees) && !looksResidential(raw.address);
        if (!ok) {
          counters.skippedHomeBased++;
          continue;
        }
      }

      const citySlug = source.citySlug ?? raw.city;
      if (!CITY_SLUGS.has(citySlug)) {
        // Counted separately from bad addresses: an unknown city means our
        // CITIES list is missing a municipality the region actually serves,
        // which is a fixable gap rather than a junk record.
        counters.skippedUnknownCity++;
        unknownCities.set(citySlug, (unknownCities.get(citySlug) ?? 0) + 1);
        continue;
      }

      if (candidates.length >= limit) {
        counters.skippedOverLimit++;
        continue;
      }

      const name = cleanName(raw.name);
      const address = repairMojibake(cleanAddress(raw.address));
      const website = normalizeWebsite(raw.website);
      const cityLabel = CITIES.find((c) => c.slug === citySlug)!.label;
      const subLabel = mapping.subcategory
        ? getBusinessSubcategoryLabel(mapping.category, mapping.subcategory)
        : null;
      const description = `${subLabel ?? getBusinessCategoryLabel(mapping.category)} in ${cityLabel}. Listed in the ${source.label}.`;

      // Slug resolution, in memory (thousands of rows — a query per row is
      // what made the first Toronto import crawl).
      const base = makeBusinessSlug(name, citySlug);
      let slug = base;
      let n = 2;
      let isUpdate = false;
      let priorCategory: string | null = null;
      for (;;) {
        const inRun = claimed.get(slug);
        if (inRun !== undefined) {
          if (inRun.toLowerCase() === address.toLowerCase()) { isUpdate = true; break; }
          slug = `${base}-${n++}`;
          continue;
        }
        const prior = existing.get(slug);
        if (!prior) { claimed.set(slug, address); break; }
        if (prior.source === "open-data" && prior.address.toLowerCase() === address.toLowerCase()) {
          claimed.set(slug, address);
          isUpdate = true;
          priorCategory = prior.category;
          break;
        }
        slug = `${base}-${n++}`;
      }

      // Same rule as the health import: a later feed never re-files a row an
      // earlier feed categorised.
      if (priorCategory !== null && priorCategory !== mapping.category) {
        counters.skippedConflict++;
        continue;
      }

      candidates.push({
        slug, name, description,
        category: mapping.category,
        subcategory: mapping.subcategory ?? null,
        city: citySlug, address,
        phone: raw.phone, website, isUpdate,
      });

      const k = `${mapping.category}/${mapping.subcategory ?? "(none)"}`;
      histogram.set(k, (histogram.get(k) ?? 0) + 1);
      perCity.set(citySlug, (perCity.get(citySlug) ?? 0) + 1);
    }
  }

  const creates = candidates.filter((c) => !c.isUpdate);
  const updates = candidates.filter((c) => c.isUpdate);

  if (!dryRun) {
    for (let i = 0; i < creates.length; i += WRITE_CHUNK) {
      const chunk = creates.slice(i, i + WRITE_CHUNK);
      await db.business.createMany({
        data: chunk.map((c) => ({
          slug: c.slug, name: c.name, description: c.description,
          category: c.category, subcategory: c.subcategory,
          city: c.city, address: c.address,
          phone: c.phone, website: c.website,
          images: [], status: "active", source: "open-data", verified: false,
        })),
        skipDuplicates: true,
      });
      process.stderr.write(`\r  created ${Math.min(i + WRITE_CHUNK, creates.length)}/${creates.length}`);
    }
    if (creates.length) process.stderr.write("\n");
    for (const u of updates) {
      await db.business.update({
        where: { slug: u.slug },
        data: {
          description: u.description, subcategory: u.subcategory,
          ...(u.phone ? { phone: u.phone } : {}),
          ...(u.website ? { website: u.website } : {}),
        },
      });
    }
  }

  counters.imported = creates.length;
  counters.updated = updates.length;

  console.log("\nCategory / subcategory:");
  for (const [k, n] of [...histogram].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${k}`);
  }
  console.log("\nPer city:");
  for (const [c, n] of perCity) console.log(`  ${c}: ${n}`);
  console.log("\nCounters:");
  for (const [k, v] of Object.entries(counters)) console.log(`  ${k.padEnd(20)} ${v}`);
  if (unknownCities.size) {
    console.log("\nUnknown cities (add to lib/cities.ts to capture these):");
    for (const [c, n] of [...unknownCities].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${c || "(blank)"}`);
    }
  }

  if (dryRun) {
    console.log("\nDRY RUN — nothing written. Sample:");
    for (const c of creates.slice(0, 15)) {
      console.log(`  ${c.slug}`);
      console.log(`     ${c.name} — ${c.category}/${c.subcategory ?? "(none)"} — ${c.address}, ${c.city}`);
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
