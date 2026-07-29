// One-off check that the hand-written parts of the init migration actually
// landed in Supabase: the pg_trgm extension, the generated tsvector column, and
// the two GIN indexes. Prisma cannot express any of these, so none of them are
// covered by `prisma validate`.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const tables = await db.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  console.log("TABLES:", tables.map((t) => t.table_name).join(", "));

  const ext = await db.$queryRaw<{ extname: string; nspname: string }[]>`
    SELECT e.extname, n.nspname
    FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm'
  `;
  console.log(
    "PG_TRGM:",
    ext.length ? `installed in schema "${ext[0].nspname}"` : "MISSING",
  );

  const generated = await db.$queryRaw<
    { column_name: string; is_generated: string; generation_expression: string | null }[]
  >`
    SELECT column_name, is_generated, generation_expression
    FROM information_schema.columns
    WHERE table_name = 'Listing' AND column_name = 'searchVector'
  `;
  console.log(
    "searchVector:",
    generated.length
      ? `is_generated=${generated[0].is_generated}`
      : "COLUMN MISSING",
  );

  const idx = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'Listing' AND indexdef ILIKE '%gin%'
    ORDER BY indexname
  `;
  console.log("GIN INDEXES:");
  for (const i of idx) console.log("  -", i.indexname);

  // Prove the generated column is actually populated by Postgres on insert,
  // that full-text matching works, and that trigram similarity tolerates a typo.
  const user = await db.user.create({
    data: { email: `verify-${Date.now()}@example.com`, name: "Verify Bot" },
  });
  const listing = await db.listing.create({
    data: {
      title: "Brown leather sectional sofa",
      description: "Comfortable three-seater couch in excellent condition.",
      priceType: "fixed",
      price: 450,
      category: "furniture",
      city: "toronto",
      images: [],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userId: user.id,
    },
  });

  const fts = await db.$queryRaw<{ id: string; rank: number }[]>`
    SELECT id, ts_rank("searchVector", plainto_tsquery('english', 'sofa')) AS rank
    FROM "Listing" WHERE "searchVector" @@ plainto_tsquery('english', 'sofa')
  `;
  console.log("FULL-TEXT 'sofa' ->", fts.length, "row(s), rank:", fts[0]?.rank);

  const couch = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Listing"
    WHERE "searchVector" @@ plainto_tsquery('english', 'couches')
  `;
  console.log("STEMMING 'couches' -> 'couch' ->", couch.length, "row(s)");

  const typo = await db.$queryRaw<{ id: string; sim: number }[]>`
    SELECT id, similarity("title", 'sofsa') AS sim
    FROM "Listing" WHERE "title" % 'sofsa'
  `;
  console.log("TRIGRAM typo 'sofsa' ->", typo.length, "row(s), sim:", typo[0]?.sim);

  await db.listing.delete({ where: { id: listing.id } });
  await db.user.delete({ where: { id: user.id } });
  console.log("cleaned up test rows");
}

main()
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
