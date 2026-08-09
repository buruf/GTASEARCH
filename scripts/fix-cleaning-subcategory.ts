// Corrective pass: re-derive home-services/cleaning rows now that dry cleaning
// is its own subcategory.
//
// The first subcategory backfill treated "cleaners" as a house-cleaning
// marker. In Toronto usage "Ace Cleaners" is a dry cleaner, so 445 of 687
// rows in home-services/cleaning were the wrong trade. Dry cleaning is now a
// subcategory in its own right (lib/business-categories.ts) and this recomputes
// every affected row against the corrected rule.
//
// Scope: home-services rows that are currently `cleaning` or null, open-data,
// unclaimed. An owner-managed listing is theirs to categorise, not ours.
//
// Usage:
//   npx tsx scripts/fix-cleaning-subcategory.ts
//   npx tsx scripts/fix-cleaning-subcategory.ts --confirm

import "dotenv/config";
import { db } from "@/lib/db";
import { subcategoryFromName } from "./import-helpers";

const WRITE_CHUNK = 250;

async function main() {
  const confirm = process.argv.includes("--confirm");
  console.log(`Cleaning-subcategory correction — ${confirm ? "LIVE" : "DRY RUN"}\n`);

  const rows = await db.business.findMany({
    where: {
      category: "home-services",
      source: "open-data",
      claimedById: null,
      OR: [{ subcategory: "cleaning" }, { subcategory: null }],
    },
    select: { id: true, name: true, category: true, subcategory: true },
  });
  console.log(`candidates: ${rows.length}`);

  const changes: { id: string; from: string | null; to: string | null; name: string }[] = [];
  for (const r of rows) {
    const next = subcategoryFromName(r.category, r.name);
    if (next !== r.subcategory) changes.push({ id: r.id, from: r.subcategory, to: next, name: r.name });
  }

  const tally = new Map<string, number>();
  for (const c of changes) {
    const key = `${c.from ?? "(none)"} -> ${c.to ?? "(none)"}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  console.log(`changes: ${changes.length}\n`);
  for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${k}`);
  }
  console.log("\nsample:");
  for (const c of changes.slice(0, 6)) {
    console.log(`  ${c.name}: ${c.from ?? "(none)"} -> ${c.to ?? "(none)"}`);
  }

  if (!confirm) {
    console.log("\nDRY RUN — nothing written. Re-run with --confirm to apply.");
    await db.$disconnect();
    return;
  }

  let done = 0;
  for (let i = 0; i < changes.length; i += WRITE_CHUNK) {
    const chunk = changes.slice(i, i + WRITE_CHUNK);
    await db.$transaction(
      chunk.map((c) =>
        db.business.update({ where: { id: c.id }, data: { subcategory: c.to } }),
      ),
    );
    done += chunk.length;
    process.stdout.write(`\r  updated ${done}/${changes.length}`);
  }
  console.log("");

  const after = await db.$queryRawUnsafe<{ subcategory: string | null; n: number }[]>(
    `SELECT subcategory, COUNT(*)::int n FROM "Business"
     WHERE status='active' AND category='home-services'
     GROUP BY subcategory ORDER BY n DESC`,
  );
  console.log("\nhome-services now:");
  for (const r of after) console.log(`  ${String(r.n).padStart(5)}  ${r.subcategory ?? "(none)"}`);

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Correction failed:", err);
  process.exit(1);
});
