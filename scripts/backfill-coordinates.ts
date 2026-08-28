// Backfills latitude/longitude onto Business, for "near me" distance search.
//
// Coordinates are never invented. Each pass takes them from the same publisher
// the business itself came from:
//
//   --source regional : the four ArcGIS business directories (Mississauga,
//                       Brampton, York, Durham) return a point geometry with
//                       every feature.
//   --source health   : Toronto Public Health's BodySafe feed carries a
//                       geometry column.
//   --source licence  : Toronto business licences carry only a street address,
//                       so those are matched against the City of Toronto One
//                       Address Repository (525,469 geocoded municipal address
//                       points) on street number + street name.
//
// A business that cannot be placed keeps NULL coordinates and never appears in
// a distance search. Deliberately no postal-code fallback: an FSA centroid can
// be a kilometre out, and for "restaurants near me" a wrong pin is worse than
// no pin.
//
// Matching is on (lower(name), lower(address)) — the importers rewrote both
// fields (cleanName, repairMojibake, cleanAddress) before storing them, so the
// raw source strings are put through the identical transforms here before
// being compared.
//
// Usage:
//   npx tsx scripts/backfill-coordinates.ts --source regional [--dry-run]

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cleanAddress, cleanName, repairMojibake } from "./import-helpers";

const WRITE_CHUNK = 500;

/**
 * GTA bounds, matching the CHECK constraint on the table. A latitude/longitude
 * swap is the classic geocoding bug and would silently place every business in
 * the Indian Ocean, so anything outside this is discarded rather than stored.
 */
function plausible(lat: number, lng: number): boolean {
  return lat >= 42 && lat <= 45.5 && lng >= -81.5 && lng <= -77;
}

const matchKey = (name: string, address: string) =>
  `${cleanName(name).toLowerCase()}|${repairMojibake(cleanAddress(address)).toLowerCase()}`;

interface Located {
  key: string;
  lat: number;
  lng: number;
}

const REGIONAL = [
  {
    label: "mississauga",
    url: "https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/2025_Mississauga_Business_Directory/FeatureServer/0",
    name: (a: Record<string, unknown>) => String(a.BusinessName ?? ""),
    address: (a: Record<string, unknown>) =>
      [a.StreetAddress, a.UnitNo ? `Unit ${a.UnitNo}` : null].filter(Boolean).join(", "),
  },
  {
    label: "brampton",
    url: "https://services3.arcgis.com/rl7ACuZkiFsmDA2g/arcgis/rest/services/Economic_Development/FeatureServer/0",
    name: (a: Record<string, unknown>) => String(a.COMPANY_NAME ?? ""),
    address: (a: Record<string, unknown>) => String(a.BUSINESS_FULL_ADDRESS ?? ""),
  },
  {
    label: "york",
    url: "https://services1.arcgis.com/GzvOwaQBbX7KLiuG/arcgis/rest/services/Business_Directory_2024/FeatureServer/1",
    name: (a: Record<string, unknown>) => String(a.NAME ?? ""),
    address: (a: Record<string, unknown>) =>
      [a.FULL_ADDRESS, a.UNIT_NUM ? `Unit ${a.UNIT_NUM}` : null].filter(Boolean).join(", "),
  },
  {
    label: "durham",
    url: "https://maps.durham.ca/arcgis/rest/services/Open_Data/Durham_OpenData/MapServer/11",
    name: (a: Record<string, unknown>) => String(a.Business_Name ?? ""),
    address: (a: Record<string, unknown>) =>
      [
        [a.Street_Number, a.Street_Name, a.Street_Type, a.Street_Direction]
          .filter(Boolean)
          .join(" "),
        a.Unit_Number ? `Unit ${a.Unit_Number}` : null,
      ]
        .filter(Boolean)
        .join(", "),
  },
];

async function fromRegional(): Promise<Located[]> {
  const out: Located[] = [];
  for (const src of REGIONAL) {
    let offset = 0;
    for (;;) {
      const url = `${src.url}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultOffset=${offset}&resultRecordCount=2000&f=json`;
      const r = await fetch(url, { signal: AbortSignal.timeout(90_000) }).then((x) => x.json());
      const feats = r.features ?? [];
      if (!feats.length) break;
      for (const f of feats) {
        const g = f.geometry;
        const a = (f.attributes ?? {}) as Record<string, unknown>;
        if (!g || typeof g.y !== "number" || typeof g.x !== "number") continue;
        if (!plausible(g.y, g.x)) continue;
        const n = src.name(a);
        const ad = src.address(a);
        if (!n || !ad) continue;
        out.push({ key: matchKey(n, ad), lat: g.y, lng: g.x });
      }
      offset += 2000;
      process.stderr.write(`\r  ${src.label}: ${out.length} points`);
      if (feats.length < 2000) break;
    }
    process.stderr.write("\n");
  }
  return out;
}

async function fromHealth(): Promise<Located[]> {
  const BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search";
  const ID = "315f0f9f-cbf0-4b95-b8a5-a4afda0f4ff5";
  const out: Located[] = [];
  let offset = 0;
  for (;;) {
    const r = await fetch(`${BASE}?resource_id=${ID}&limit=5000&offset=${offset}`, {
      signal: AbortSignal.timeout(90_000),
    }).then((x) => x.json());
    const recs = r.result.records ?? [];
    if (!recs.length) break;
    for (const rec of recs) {
      const raw = rec.geometry;
      if (!raw) continue;
      try {
        const g = typeof raw === "string" ? JSON.parse(raw) : raw;
        const [lng, lat] = g.coordinates ?? [];
        if (typeof lat !== "number" || typeof lng !== "number") continue;
        if (!plausible(lat, lng)) continue;
        const n = rec.estName as string;
        const ad = rec.addrFull as string;
        if (!n || !ad) continue;
        out.push({ key: matchKey(n, ad), lat, lng });
      } catch {
        /* a malformed geometry is skipped, never guessed at */
      }
    }
    offset += 5000;
    process.stderr.write(`\r  health: ${out.length} points`);
    if (offset >= r.result.total) break;
  }
  process.stderr.write("\n");
  return out;
}

/**
 * Toronto business licences carry a street address but no coordinates, so they
 * are placed against the City of Toronto One Address Repository — 525,469
 * geocoded municipal address points, the City's own authoritative list.
 *
 * Matching is exact on a normalised "number street" string. The repository
 * writes ADDRESS_FULL as "795 St Clair Ave W", including the direction
 * suffix, which is the same shape our licence addresses use once the unit is
 * removed. No fuzzy matching: a near-miss on a street name would place a
 * business on the wrong road, and being absent from distance search is far
 * better than being wrong in it.
 */
function normalizeStreetAddress(raw: string): string {
  return raw
    // Everything after the first comma is a unit, floor or suite.
    .split(",")[0]
    // As are these, when they appear without a comma.
    .replace(/\s+(unit|suite|ste|apt|fl|floor|bsmt|basement|ground fl)\b.*$/i, "")
    .replace(/\s*#.*$/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fromAddressRepository(): Promise<Map<string, { lat: number; lng: number }>> {
  const BASE = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search";
  const ID = "0b3756af-9caf-4f0f-ac28-9c6617adede4";
  const index = new Map<string, { lat: number; lng: number }>();
  let offset = 0;
  for (;;) {
    const url = `${BASE}?resource_id=${ID}&limit=10000&offset=${offset}&fields=ADDRESS_FULL,geometry`;
    const r = await fetch(url, { signal: AbortSignal.timeout(120_000) }).then((x) => x.json());
    const recs = r.result.records ?? [];
    if (!recs.length) break;
    for (const rec of recs) {
      const full = rec.ADDRESS_FULL as string | null;
      const raw = rec.geometry;
      if (!full || !raw) continue;
      try {
        const g = typeof raw === "string" ? JSON.parse(raw) : raw;
        const [lng, lat] = g.coordinates ?? [];
        if (typeof lat !== "number" || typeof lng !== "number") continue;
        if (!plausible(lat, lng)) continue;
        const key = normalizeStreetAddress(full);
        // First writer wins: a duplicated address point is the same building.
        if (key && !index.has(key)) index.set(key, { lat, lng });
      } catch {
        /* malformed geometry skipped */
      }
    }
    offset += 10000;
    process.stderr.write(`\r  address points: ${index.size} indexed`);
    if (offset >= r.result.total) break;
  }
  process.stderr.write("\n");
  return index;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const which = argv.includes("--source") ? argv[argv.indexOf("--source") + 1] : "regional";

  console.log(`Coordinate backfill — source=${which}, ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  const updates: { id: string; lat: number; lng: number }[] = [];

  if (which === "licence") {
    // Address-based, not name-based: the licence feed and the address
    // repository share no identifier, only the street address.
    const index = await fromAddressRepository();
    console.log(`\n  indexed addresses: ${index.size}`);

    const targets = await db.business.findMany({
      where: {
        latitude: null,
        city: { in: ["toronto", "scarborough", "etobicoke", "north-york"] },
      },
      select: { id: true, address: true },
    });
    console.log(`  Toronto-area businesses without coordinates: ${targets.length}`);

    for (const b of targets) {
      const hit = index.get(normalizeStreetAddress(b.address));
      if (hit) updates.push({ id: b.id, lat: hit.lat, lng: hit.lng });
    }
  } else {
    const located = which === "health" ? await fromHealth() : await fromRegional();

    const byKey = new Map<string, { lat: number; lng: number }>();
    for (const l of located) if (!byKey.has(l.key)) byKey.set(l.key, { lat: l.lat, lng: l.lng });
    console.log(`\n  distinct located keys: ${byKey.size}`);

    const targets = await db.business.findMany({
      where: { latitude: null },
      select: { id: true, name: true, address: true },
    });
    console.log(`  businesses without coordinates: ${targets.length}`);

    for (const b of targets) {
      const hit = byKey.get(`${b.name.toLowerCase()}|${b.address.toLowerCase()}`);
      if (hit) updates.push({ id: b.id, lat: hit.lat, lng: hit.lng });
    }
  }

  console.log(`  matched: ${updates.length}`);

  if (dryRun) {
    console.log("\nDRY RUN — nothing written.");
    await db.$disconnect();
    return;
  }

  // ONE statement per chunk, not one per row. The first version wrapped 500
  // db.business.update() calls in an interactive transaction, and Prisma sends
  // those to the server individually — 500 round trips per chunk, which at the
  // observed ~300ms latency worked out at roughly 2.7 hours for 32,000 rows.
  // A single UPDATE ... FROM (VALUES ...) is one round trip per chunk.
  let done = 0;
  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    const chunk = updates.slice(i, i + WRITE_CHUNK);
    const values = Prisma.join(
      chunk.map(
        (u) => Prisma.sql`(${u.id}, ${u.lat}::double precision, ${u.lng}::double precision)`,
      ),
    );
    await db.$executeRaw`
      UPDATE "Business" AS b
      SET latitude = v.lat, longitude = v.lng
      FROM (VALUES ${values}) AS v(id, lat, lng)
      WHERE b.id = v.id
    `;
    done += chunk.length;
    process.stdout.write(`\r  written ${done}/${updates.length}`);
  }
  console.log("");

  const withCoords = await db.business.count({
    where: { status: "active", latitude: { not: null } },
  });
  const total = await db.business.count({ where: { status: "active" } });
  console.log(`\ncoverage: ${withCoords}/${total} (${Math.round((withCoords / total) * 100)}%)`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("\nBackfill failed:", e);
  process.exit(1);
});
