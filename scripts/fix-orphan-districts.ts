// Corrects the district on Toronto rows the last import did not rewrite.
//
// The district split assigns Toronto / Scarborough / Etobicoke / North York
// from the postal code on the licence record. Rows the split run happened not
// to touch kept city:"toronto" regardless of where they actually are — so
// "Abbi Towing, 6474 Kingston Rd" (Scarborough) and "Bg Automotive, 11 Racine
// Rd" (Etobicoke) still sit under Toronto.
//
// These rows are NOT duplicates — every one was checked to have no
// same-name/same-address twin in a district — and spot checks against the live
// licence data confirm many are still active businesses. So they are corrected
// in place rather than deleted.
//
// The postal code is not stored on Business, so it is read back from the City
// of Toronto licence feed by name + address. A row we cannot find, or whose
// postal does not resolve, is left exactly as it is.
//
// The slug embeds the city, so a corrected row also needs a corrected slug;
// collisions are suffixed the same way the importers do it.
//
// Usage:
//   npx tsx scripts/fix-orphan-districts.ts
//   npx tsx scripts/fix-orphan-districts.ts --confirm

import "dotenv/config";
import { db } from "@/lib/db";
import { makeBusinessSlug } from "@/lib/business-slug";
import { districtFromPostal } from "./toronto-districts";

const CKAN = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search";
const RESOURCE_ID = "169e90ba-3ae0-43dd-8b2f-919e87002f50";

/** Looks a business up in the licence feed and returns its postal code. */
async function postalFor(name: string, address: string): Promise<string | null> {
  const url = new URL(CKAN);
  url.searchParams.set("resource_id", RESOURCE_ID);
  url.searchParams.set("q", name);
  url.searchParams.set("limit", "50");
  try {
    const json = await fetch(url, { signal: AbortSignal.timeout(30_000) }).then((r) => r.json());
    const recs: Record<string, string | null>[] = json.result?.records ?? [];
    const street = address.split(",")[0].trim().toLowerCase();
    const hit = recs.find(
      (r) =>
        String(r["Licence Address Line 1"] ?? "").trim().toLowerCase() === street &&
        String(r["Operating Name"] ?? "").trim().toLowerCase() === name.toLowerCase(),
    );
    return hit ? (String(hit["Licence Address Line 3"] ?? "").trim() || null) : null;
  } catch {
    return null;
  }
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  console.log(`Orphan district correction — ${confirm ? "LIVE" : "DRY RUN"}\n`);

  const rows = await db.$queryRawUnsafe<
    { id: string; name: string; address: string; slug: string }[]
  >(`
    SELECT s.id, s.name, s.address, s.slug
    FROM "Business" s
    WHERE s.city = 'toronto' AND s.source = 'open-data' AND s."claimedById" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Business" d
        WHERE d.city IN ('scarborough','etobicoke','north-york')
          AND lower(d.name) = lower(s.name) AND lower(d.address) = lower(s.address))
      AND s."updatedAt" < NOW() - INTERVAL '1 day'
    ORDER BY s.name
  `);
  console.log(`rows to check: ${rows.length}`);

  const moves: { id: string; name: string; from: string; to: string; slug: string }[] = [];
  let unknown = 0;
  for (const [i, r] of rows.entries()) {
    const postal = await postalFor(r.name, r.address);
    const district = postal ? districtFromPostal(postal) : null;
    if (!district) {
      unknown++;
    } else if (district !== "toronto") {
      moves.push({ id: r.id, name: r.name, from: "toronto", to: district, slug: r.slug });
    }
    if (i % 20 === 0) process.stderr.write(`\r  checked ${i}/${rows.length}`);
  }
  process.stderr.write(`\r  checked ${rows.length}/${rows.length}\n`);

  const tally = new Map<string, number>();
  for (const m of moves) tally.set(m.to, (tally.get(m.to) ?? 0) + 1);
  console.log(`\nnot found in the feed / no postal (left alone): ${unknown}`);
  console.log(`confirmed still Toronto: ${rows.length - unknown - moves.length}`);
  console.log(`to move: ${moves.length}`);
  for (const [d, n] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${d}`);
  console.log("\nsample:");
  for (const m of moves.slice(0, 8)) console.log(`  ${m.name}: toronto -> ${m.to}`);

  if (!confirm) {
    console.log("\nDRY RUN — nothing written. Re-run with --confirm to apply.");
    await db.$disconnect();
    return;
  }

  let done = 0;
  for (const m of moves) {
    // The slug carries the city, so it has to move too. Suffix on collision,
    // the same rule the importers use.
    let slug = makeBusinessSlug(m.name, m.to);
    let n = 2;
    for (;;) {
      const clash = await db.business.findUnique({ where: { slug }, select: { id: true } });
      if (!clash || clash.id === m.id) break;
      slug = `${makeBusinessSlug(m.name, m.to)}-${n++}`;
    }
    await db.business.update({ where: { id: m.id }, data: { city: m.to, slug } });
    done++;
    if (done % 20 === 0) process.stderr.write(`\r  moved ${done}/${moves.length}`);
  }
  process.stderr.write(`\r  moved ${done}/${moves.length}\n`);

  const after = await db.$queryRawUnsafe<{ city: string; n: number }[]>(
    `SELECT city, COUNT(*)::int n FROM "Business" WHERE status='active'
       AND city IN ('toronto','scarborough','etobicoke','north-york')
     GROUP BY city ORDER BY n DESC`,
  );
  console.log("\nToronto districts now:");
  for (const r of after) console.log(`  ${String(r.n).padStart(6)}  ${r.city}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Correction failed:", err);
  process.exit(1);
});
