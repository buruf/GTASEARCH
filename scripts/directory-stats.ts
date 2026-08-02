// Quick read-only directory census — category/subcategory counts and a few
// sample rows. Used to verify import batches; safe to run anytime.
import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
  const total = await db.business.count({ where: { status: "active" } });
  console.log(`active businesses: ${total}\n`);

  const byCategory = await db.business.groupBy({
    by: ["category"],
    where: { status: "active" },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
  });
  console.log("by category:");
  for (const r of byCategory) console.log(`  ${String(r._count._all).padStart(5)}  ${r.category}`);

  const bySub = await db.business.groupBy({
    by: ["category", "subcategory"],
    where: { status: "active" },
    _count: { _all: true },
  });
  console.log("\nby subcategory:");
  for (const r of bySub.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${String(r._count._all).padStart(5)}  ${r.category}/${r.subcategory ?? "(none)"}`);
  }

  const dupes = await db.$queryRaw<{ name: string; address: string; n: bigint }[]>`
    SELECT name, address, COUNT(*) AS n
    FROM "Business"
    GROUP BY name, address
    HAVING COUNT(*) > 1
    ORDER BY n DESC
    LIMIT 5`;
  console.log(`\nduplicate name+address groups: ${dupes.length}`);
  for (const d of dupes) console.log(`  ${d.n}x ${d.name} — ${d.address}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
