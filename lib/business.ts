// Business directory search and browse.
//
// This is the only other module in the app (besides lib/search.ts) that uses
// raw SQL, and only for the same reason: Prisma cannot express tsvector
// matching, ts_rank ordering, or trigram operators. Structure, thresholds and
// the degrade-don't-throw param parsing intentionally mirror lib/search.ts —
// keep the two in sync if either changes.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getBusinessCategory } from "@/lib/business-categories";
import { getCity } from "@/lib/cities";

export const BUSINESS_PAGE_SIZE = 24;

/** Below this many full-text hits, retry with the typo-tolerant trigram path. */
const FALLBACK_THRESHOLD = 5;

/** Same threshold as lib/search.ts — see that file's comment for the measured
 *  rationale. Kept identical so the two directories behave consistently. */
const WORD_SIMILARITY_THRESHOLD = 0.45;

export interface BusinessRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  subcategory: string | null;
  city: string;
  neighbourhood: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  images: string[];
  verified: boolean;
}

export interface BusinessSearchFilters {
  q: string;
  category?: string;
  city?: string;
  page: number;
}

export interface BusinessSearchResult {
  rows: BusinessRow[];
  total: number;
  /** True when full-text found too little and trigram matching was used. */
  usedFallback: boolean;
}

/**
 * Parses raw URL search params into filters.
 *
 * Every field degrades rather than throws: directory URLs are user-editable
 * and shareable, so /businesses must never return a 500 no matter what is
 * typed into the address bar. Unknown categories and cities are dropped, and
 * the page number is clamped.
 */
export function parseBusinessSearchParams(
  params: Record<string, string | string[] | undefined>,
): BusinessSearchFilters {
  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  const rawQ = (one(params.q) ?? "").trim().slice(0, 100);

  const categorySlug = one(params.category);
  const category = getBusinessCategory(categorySlug)?.slug;

  const citySlug = one(params.city);
  const city = getCity(citySlug)?.slug;

  const pageRaw = Number(one(params.page) ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return { q: rawQ, category, city, page };
}

/** Only active businesses are ever publicly visible. */
const VISIBLE_BIZ = Prisma.sql`"status" = 'active'`;

function filterConditions(f: BusinessSearchFilters): Prisma.Sql[] {
  const conds: Prisma.Sql[] = [VISIBLE_BIZ];

  if (f.category) conds.push(Prisma.sql`"category" = ${f.category}`);
  if (f.city) conds.push(Prisma.sql`"city" = ${f.city}`);

  return conds;
}

/**
 * Ordering: verified businesses lead in every mode — that is what claiming
 * (Phase 5B) buys. "name" is the primary sort/relevance tiebreaker, and "id"
 * is the final tiebreaker in every mode: businesses tied on name (or rank, or
 * word_similarity) would otherwise be returned in a Postgres-chosen order
 * that can vary query to query, which shuffles rows across page boundaries as
 * a user paginates.
 */
function orderBy(relevance: Prisma.Sql | null): Prisma.Sql {
  return relevance
    ? Prisma.sql`"verified" DESC, ${relevance} DESC, "name" ASC, "id"`
    : Prisma.sql`"verified" DESC, "name" ASC, "id"`;
}

const SELECT_COLUMNS = Prisma.sql`
  "id", "slug", "name", "description", "category", "subcategory",
  "city", "neighbourhood", "address", "phone", "website", "images", "verified"
`;

export async function searchBusinesses(
  f: BusinessSearchFilters,
): Promise<BusinessSearchResult> {
  const conds = filterConditions(f);
  const offset = (f.page - 1) * BUSINESS_PAGE_SIZE;

  // No keyword: plain filtered browse, no text matching at all.
  if (!f.q) {
    const where = Prisma.join(conds, " AND ");
    const [rows, countRows] = await Promise.all([
      db.$queryRaw<BusinessRow[]>`
        SELECT ${SELECT_COLUMNS} FROM "Business"
        WHERE ${where}
        ORDER BY ${orderBy(null)}
        LIMIT ${BUSINESS_PAGE_SIZE} OFFSET ${offset}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM "Business" WHERE ${where}
      `,
    ]);
    return { rows, total: Number(countRows[0].count), usedFallback: false };
  }

  // Primary path: ranked full-text search over the generated tsvector.
  const tsquery = Prisma.sql`plainto_tsquery('english', ${f.q})`;
  const ftsWhere = Prisma.join(
    [...conds, Prisma.sql`"searchVector" @@ ${tsquery}`],
    " AND ",
  );
  const rank = Prisma.sql`ts_rank("searchVector", ${tsquery})`;

  const [ftsRows, ftsCount] = await Promise.all([
    db.$queryRaw<BusinessRow[]>`
      SELECT ${SELECT_COLUMNS} FROM "Business"
      WHERE ${ftsWhere}
      ORDER BY ${orderBy(rank)}
      LIMIT ${BUSINESS_PAGE_SIZE} OFFSET ${offset}
    `,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "Business" WHERE ${ftsWhere}
    `,
  ]);

  const total = Number(ftsCount[0].count);
  if (total >= FALLBACK_THRESHOLD || f.page > 1) {
    return { rows: ftsRows, total, usedFallback: false };
  }

  // Fallback: trigram matching against the name, for misspellings that
  // full-text search cannot resolve. Runs in a transaction so SET LOCAL cannot
  // leak the lowered threshold onto other pooled connections.
  const trgmWhere = Prisma.join(
    [...conds, Prisma.sql`${f.q} <% "name"`],
    " AND ",
  );
  const wsim = Prisma.sql`word_similarity(${f.q}, "name")`;

  const [, trgmRows, trgmCount] = await db.$transaction([
    db.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(
      WORD_SIMILARITY_THRESHOLD,
    )}, true)`,
    db.$queryRaw<BusinessRow[]>`
      SELECT ${SELECT_COLUMNS} FROM "Business"
      WHERE ${trgmWhere}
      ORDER BY ${orderBy(wsim)}
      LIMIT ${BUSINESS_PAGE_SIZE} OFFSET ${offset}
    `,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "Business" WHERE ${trgmWhere}
    `,
  ]);

  const trgmTotal = Number(trgmCount[0].count);
  // Only prefer the fallback if it genuinely found more.
  if (trgmTotal > total) {
    return { rows: trgmRows, total: trgmTotal, usedFallback: true };
  }
  return { rows: ftsRows, total, usedFallback: false };
}

/** Business profile page: active only. Plain Prisma query builder — no text
 *  matching or ranking involved, so raw SQL buys nothing here. */
export async function getBusiness(
  slug: string,
): Promise<
  (BusinessRow & { hours: string | null; createdAt: Date; claimedById: string | null }) | null
> {
  return db.business.findFirst({
    where: { slug, status: "active" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      subcategory: true,
      city: true,
      neighbourhood: true,
      address: true,
      phone: true,
      website: true,
      images: true,
      verified: true,
      hours: true,
      createdAt: true,
      // Drives the "Is this your business?" claim CTA — hidden once owned.
      claimedById: true,
    },
  });
}

const BROWSE_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  category: true,
  subcategory: true,
  city: true,
  neighbourhood: true,
  address: true,
  phone: true,
  website: true,
  images: true,
  verified: true,
} as const;

/**
 * Category (and optional city / subcategory) browse page: alphabetical by
 * name, verified businesses first. Query builder, not raw SQL — no text
 * matching is involved. `subcategory` is optional so Task 5's `?sub=` filter
 * can reuse this without a second code path.
 */
export async function browseBusinesses(
  category: string,
  city: string | undefined,
  page: number,
  subcategory?: string,
): Promise<{ rows: BusinessRow[]; total: number }> {
  const where = {
    status: "active",
    category,
    ...(city ? { city } : {}),
    ...(subcategory ? { subcategory } : {}),
  };
  const offset = (page - 1) * BUSINESS_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    db.business.findMany({
      where,
      select: BROWSE_SELECT,
      orderBy: [{ verified: "desc" }, { name: "asc" }, { id: "asc" }],
      take: BUSINESS_PAGE_SIZE,
      skip: offset,
    }),
    db.business.count({ where }),
  ]);

  return { rows, total };
}

/** Directory homepage / nav: business counts per category. */
export async function businessCountsByCategory(): Promise<
  Record<string, number>
> {
  const rows = await db.business.groupBy({
    by: ["category"],
    where: { status: "active" },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.category, r._count._all]));
}

/** City counts within a category, for the category browse page's city filter.
 *  Omit the category for directory-wide totals per city — what the homepage's
 *  "browse by city" section needs. */
export async function businessCityCounts(
  category?: string,
): Promise<Record<string, number>> {
  const rows = await db.business.groupBy({
    by: ["city"],
    where: { status: "active", ...(category ? { category } : {}) },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.city, r._count._all]));
}

/** Category counts within a city, for the category/city browse page's
 *  "other categories in this city" cross-links — keeps those links off of
 *  empty category×city pages that the sitemap deliberately excludes. */
export async function businessCategoryCountsForCity(
  city: string,
): Promise<Record<string, number>> {
  const rows = await db.business.groupBy({
    by: ["category"],
    where: { status: "active", city },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.category, r._count._all]));
}

/** Subcategory counts within a category (and optional city), for the
 *  category / category+city browse pages' subcategory chips — count-gated so
 *  a chip never deep-links to a filter combination with zero results. Rows
 *  with a null subcategory (not every imported business has one) are
 *  skipped rather than counted under some placeholder key. */
export async function businessSubcategoryCounts(
  category: string,
  city?: string,
): Promise<Record<string, number>> {
  const rows = await db.business.groupBy({
    by: ["subcategory"],
    where: {
      status: "active",
      category,
      ...(city ? { city } : {}),
      subcategory: { not: null },
    },
    _count: { _all: true },
  });
  return Object.fromEntries(
    rows
      .filter((r) => r.subcategory !== null)
      .map((r) => [r.subcategory as string, r._count._all]),
  );
}

/** Directory hub "Recently added" strip: newest active businesses, newest
 *  first. Query builder, not raw SQL — no text matching is involved. */
export async function newestBusinesses(limit = 8): Promise<BusinessRow[]> {
  return db.business.findMany({
    where: { status: "active" },
    select: BROWSE_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });
}

/** Business profile page: same category and city, excluding the business
 *  itself. Verified first, then name — same ordering rule as everywhere else
 *  in this module. */
export async function similarBusinesses(
  slug: string,
  category: string,
  city: string,
  limit = 4,
): Promise<BusinessRow[]> {
  return db.business.findMany({
    where: {
      status: "active",
      category,
      city,
      slug: { not: slug },
    },
    select: BROWSE_SELECT,
    orderBy: [{ verified: "desc" }, { name: "asc" }, { id: "asc" }],
    take: limit,
  });
}
