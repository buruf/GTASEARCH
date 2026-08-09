// One-off cleanup after splitting Toronto into its four districts.
//
// WHAT HAPPENED. Toronto businesses used to be stored with city:"toronto".
// The importers now assign each row to Toronto, Scarborough, Etobicoke or
// North York (scripts/toronto-districts.ts). A business's slug contains its
// city, so a shop that moved to Scarborough was written as a NEW row
// (`name-scarborough`) and its old `name-toronto` row was left behind. Those
// leftovers are duplicates and this script removes them.
//
// WHAT IT WILL NOT TOUCH — the conditions matter more than the deletion:
//
//   1. Only rows with a PROVEN replacement. A stale row is deleted only if a
//      row with the same name AND same address now exists in one of the three
//      districts. Without that check the query would also sweep up ~166 rows
//      that this import simply did not re-fetch — expired licences, premises
//      whose last inspection fell outside the freshness window — which are
//      genuinely old-Toronto addresses (374A Yonge, 541 Danforth, 648
//      Spadina) and nothing to do with the district split. Removing those
//      would be a separate decision made by accident.
//   2. Only source:"open-data". Anything curated or self-submitted is left.
//   3. Never anything a person has attached themselves to: no claimed
//      business, none with a review, none with a claim on file.
//   4. Only rows untouched by the split run, i.e. updatedAt < --before.
//
// Usage — dry run first, it is the default:
//   npx tsx scripts/prune-superseded-toronto.ts --before 2026-08-08T03:13:49.000Z
//   npx tsx scripts/prune-superseded-toronto.ts --before <same> --confirm

import "dotenv/config";
import { db } from "@/lib/db";

const DISTRICTS = ["scarborough", "etobicoke", "north-york"];

function parseArgs(argv: string[]) {
  let before: Date | null = null;
  let confirm = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--confirm") confirm = true;
    else if (a === "--before" || a.startsWith("--before=")) {
      const raw = a.startsWith("--before=") ? a.slice("--before=".length) : argv[++i];
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) throw new Error(`--before is not a date: ${raw}`);
      before = d;
    }
  }
  if (!before) throw new Error("--before <ISO timestamp> is required (the moment the split run started)");
  return { before, confirm };
}

/** The single condition both the preview and the delete are built from. */
const WHERE = `
  s.city = 'toronto'
  AND s.source = 'open-data'
  AND s."updatedAt" < $1
  AND s."claimedById" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Review" r WHERE r."businessId" = s.id)
  AND NOT EXISTS (SELECT 1 FROM "BusinessClaim" c WHERE c."businessId" = s.id)
  AND EXISTS (
    SELECT 1 FROM "Business" d
    WHERE d.city = ANY($2)
      AND lower(d.name) = lower(s.name)
      AND lower(d.address) = lower(s.address)
  )
`;

async function main() {
  const { before, confirm } = parseArgs(process.argv.slice(2));
  console.log(`Superseded-Toronto prune — ${confirm ? "LIVE" : "DRY RUN"}`);
  console.log(`  before: ${before.toISOString()}\n`);

  const [{ n: target }] = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int n FROM "Business" s WHERE ${WHERE}`,
    before,
    DISTRICTS,
  );
  const [{ n: keptNoTwin }] = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int n FROM "Business" s
     WHERE s.city='toronto' AND s.source='open-data' AND s."updatedAt" < $1
       AND NOT EXISTS (
         SELECT 1 FROM "Business" d WHERE d.city = ANY($2)
           AND lower(d.name) = lower(s.name) AND lower(d.address) = lower(s.address))`,
    before,
    DISTRICTS,
  );

  console.log(`  to delete (superseded, replacement verified): ${target}`);
  console.log(`  kept — stale but NO district twin:            ${keptNoTwin}`);

  const sample = await db.$queryRawUnsafe<{ name: string; address: string }[]>(
    `SELECT s.name, s.address FROM "Business" s WHERE ${WHERE} LIMIT 5`,
    before,
    DISTRICTS,
  );
  console.log("\n  sample:");
  for (const s of sample) console.log(`    ${s.name} | ${s.address}`);

  if (!confirm) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --confirm to apply.");
    await db.$disconnect();
    return;
  }

  const deleted = await db.$executeRawUnsafe(
    `DELETE FROM "Business" s WHERE ${WHERE}`,
    before,
    DISTRICTS,
  );
  console.log(`\nDeleted ${deleted} superseded rows.`);

  const rows = await db.$queryRawUnsafe<{ city: string; n: number }[]>(
    `SELECT city, COUNT(*)::int n FROM "Business" WHERE status='active'
       AND city IN ('toronto','scarborough','etobicoke','north-york')
     GROUP BY city ORDER BY n DESC`,
  );
  console.log("\nToronto districts now:");
  for (const r of rows) console.log(`  ${String(r.n).padStart(6)}  ${r.city}`);

  const dupes = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COUNT(*)::int n FROM (
       SELECT 1 FROM "Business" GROUP BY name, address, city HAVING COUNT(*) > 1
     ) t`,
  );
  console.log(`\nduplicate name+address+city groups: ${dupes[0].n}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Prune failed:", err);
  process.exit(1);
});
