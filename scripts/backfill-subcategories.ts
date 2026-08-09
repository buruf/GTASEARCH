// Backfills subcategories onto businesses already in the directory.
//
// The importers now read a subcategory from the business name when the source
// records none (subcategoryFromName in import-helpers). This applies the same
// rule to rows imported before that existed, so the 21,230 businesses sitting
// at top level only — 53% of all restaurants — become reachable from the
// filters people actually use.
//
// SAFETY:
//   - Only rows where subcategory IS NULL. An existing subcategory came from a
//     NAICS code or a licence class, which is evidence; a name is inference,
//     and inference must never overwrite evidence.
//   - Only source:"open-data". Curated and owner-submitted rows are left alone.
//   - Never a claimed business. Once an owner manages a listing, its
//     categorisation is theirs to set, not ours to infer.
//   - One unambiguous name marker or nothing (subcategoryFromName's own rule).
//
// Usage — dry run is the default:
//   npx tsx scripts/backfill-subcategories.ts
//   npx tsx scripts/backfill-subcategories.ts --confirm

import "dotenv/config";
import { db } from "@/lib/db";
import { subcategoryFromName } from "./import-helpers";

const WRITE_CHUNK = 250;

async function main() {
  const confirm = process.argv.includes("--confirm");
  console.log(`Subcategory backfill — ${confirm ? "LIVE" : "DRY RUN"}\n`);

  const rows = await db.business.findMany({
    where: { subcategory: null, source: "open-data", claimedById: null },
    select: { id: true, name: true, category: true },
  });
  console.log(`candidates (no subcategory, open-data, unclaimed): ${rows.length}`);

  const updates: { id: string; subcategory: string }[] = [];
  const tally = new Map<string, number>();
  for (const r of rows) {
    const sub = subcategoryFromName(r.category, r.name);
    if (!sub) continue;
    updates.push({ id: r.id, subcategory: sub });
    const key = `${r.category}/${sub}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }

  console.log(`resolvable from the name: ${updates.length}`);
  console.log(`left null (name says nothing, or says two things): ${rows.length - updates.length}\n`);

  console.log("what would be set:");
  for (const [key, n] of [...tally].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(6)}  ${key}`);
  }

  const samples = updates.slice(0, 6);
  const names = new Map(rows.map((r) => [r.id, r.name]));
  console.log("\nsample:");
  for (const u of samples) console.log(`  ${names.get(u.id)} -> ${u.subcategory}`);

  if (!confirm) {
    console.log("\nDRY RUN — nothing written. Re-run with --confirm to apply.");
    await db.$disconnect();
    return;
  }

  let done = 0;
  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    const chunk = updates.slice(i, i + WRITE_CHUNK);
    await db.$transaction(
      chunk.map((u) =>
        db.business.update({
          where: { id: u.id },
          data: { subcategory: u.subcategory },
        }),
      ),
    );
    done += chunk.length;
    process.stdout.write(`\r  updated ${done}/${updates.length}`);
  }
  console.log("");

  const remaining = await db.business.count({
    where: { status: "active", subcategory: null },
  });
  const total = await db.business.count({ where: { status: "active" } });
  console.log(
    `\nstill without a subcategory: ${remaining} of ${total} (${Math.round((remaining / total) * 100)}%)`,
  );

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
