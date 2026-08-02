import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
  // Rows created by an earlier import batch but touched by a later one.
  const rows = await db.$queryRaw<
    { slug: string; name: string; category: string; subcategory: string | null; address: string; description: string; createdAt: Date; updatedAt: Date }[]
  >`
    SELECT slug, name, category, subcategory, address, description, "createdAt", "updatedAt"
    FROM "Business"
    WHERE "updatedAt" - "createdAt" > interval '1 hour'
    ORDER BY "updatedAt" DESC
    LIMIT 20`;
  console.log(`rows updated after creation: ${rows.length}\n`);
  for (const r of rows) {
    console.log(`${r.slug}`);
    console.log(`  ${r.name} — ${r.category}/${r.subcategory ?? "(none)"}`);
    console.log(`  ${r.address}`);
    console.log(`  "${r.description}"`);
    console.log(`  created ${r.createdAt.toISOString()} / updated ${r.updatedAt.toISOString()}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
