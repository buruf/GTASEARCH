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
// --refile-fast-food: the ONE sanctioned overwrite.
//
//   Cuisines were added to the taxonomy in Sep 2026. 788 restaurants were
//   already sitting on subcategory "fast-food" while their own names said
//   otherwise — "Jerk King", "Churrasqueira Do Sardinha", "Paramount Lebanese
//   Kitchen". That value is real evidence, but of the wrong QUESTION: it comes
//   from NAICS 722512 "Limited-Service Restaurants", which describes how the
//   food is served, not what it is. Someone browsing Caribbean would not find
//   Jerk King, which makes the new cuisine filters worth much less than they
//   look.
//
//   So this overwrites "fast-food" and ONLY "fast-food", and only ever with a
//   cuisine — never a format, never any other existing subcategory, and only
//   where the strict name rule resolves. Grocery is deliberately excluded:
//   "Emeye Injera & Mini Mart" really is a shop, and calling it African would
//   lose the more useful fact.
//
//   It does not round-trip — the old value is not recorded anywhere — so it is
//   gated behind its own flag rather than riding along with the normal run.
//
// Usage — dry run is the default:
//   npx tsx scripts/backfill-subcategories.ts
//   npx tsx scripts/backfill-subcategories.ts --confirm
//   npx tsx scripts/backfill-subcategories.ts --refile-fast-food [--confirm]

import "dotenv/config";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { subcategoryFromName } from "./import-helpers";

const WRITE_CHUNK = 250;

/** The cuisines, and only the cuisines, may replace a "fast-food" value. */
const CUISINES = new Set([
  "african", "caribbean", "chinese", "filipino", "greek", "indian", "italian",
  "japanese", "korean", "mexican", "middle-eastern", "portuguese", "thai",
  "vietnamese",
]);

async function main() {
  const confirm = process.argv.includes("--confirm");
  const refile = process.argv.includes("--refile-fast-food");
  console.log(
    `Subcategory ${refile ? "fast-food re-file" : "backfill"} — ${confirm ? "LIVE" : "DRY RUN"}\n`,
  );

  const rows = await db.business.findMany({
    where: refile
      ? { subcategory: "fast-food", category: "restaurants", source: "open-data", claimedById: null }
      : { subcategory: null, source: "open-data", claimedById: null },
    select: { id: true, name: true, category: true },
  });
  console.log(
    refile
      ? `candidates (fast-food restaurants, open-data, unclaimed): ${rows.length}`
      : `candidates (no subcategory, open-data, unclaimed): ${rows.length}`,
  );

  const updates: { id: string; subcategory: string }[] = [];
  const tally = new Map<string, number>();
  for (const r of rows) {
    const sub = subcategoryFromName(r.category, r.name);
    if (!sub) continue;
    // In re-file mode the name must resolve to a CUISINE. Anything else is
    // either the value already there or another format label, and neither is
    // a reason to overwrite evidence.
    if (refile && !CUISINES.has(sub)) continue;
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

  // ONE statement per chunk, not one per row. This used to wrap 250
  // db.business.update() calls in a transaction, and Prisma sends those to the
  // server individually — 250 round trips per chunk. Same fix, and the same
  // reason, as scripts/backfill-coordinates.ts, where that shape put a 32,000
  // row backfill on course to take 2.7 hours.
  //
  // Writing `subcategory` also rewrites `searchVector`, a STORED generated
  // column that includes the subcategory slug at weight C. So this pass does
  // not merely fill in a filter: it makes every one of these businesses
  // findable by searching its cuisine.
  let done = 0;
  for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
    const chunk = updates.slice(i, i + WRITE_CHUNK);
    const values = Prisma.join(
      chunk.map((u) => Prisma.sql`(${u.id}, ${u.subcategory})`),
    );
    await db.$executeRaw`
      UPDATE "Business" AS b
      SET subcategory = v.sub
      FROM (VALUES ${values}) AS v(id, sub)
      WHERE b.id = v.id
    `;
    done += chunk.length;
    process.stdout.write(`\r  written ${done}/${updates.length}`);
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
