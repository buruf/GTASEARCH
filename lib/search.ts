// Listing search and filtering.
//
// This is the only module in the app that uses raw SQL. Everything else uses
// the Prisma query builder. Raw SQL is required here because Prisma cannot
// express tsvector matching, ts_rank ordering, trigram operators, or the
// effective-boost CASE expression.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCategory } from "@/lib/categories";
import { validCitySlugs } from "@/lib/cities";

export const PAGE_SIZE = 24;

/** Below this many full-text hits, retry with the typo-tolerant trigram path. */
const FALLBACK_THRESHOLD = 5;

/**
 * Measured, not guessed. word_similarity()'s 0.6 default rejects real
 * transpositions ("sofsa" against "sofa" scores 0.500), while the strongest
 * true negative measured ("couch" against unrelated titles) scores 0.167.
 * 0.45 sits in the empty band between them. See the design spec for the table.
 */
const WORD_SIMILARITY_THRESHOLD = 0.45;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export const POSTED_OPTIONS = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export const TYPE_OPTIONS = [
  { value: "fixed", label: "For Sale" },
  { value: "free", label: "Free" },
  { value: "trade", label: "Trade" },
  { value: "contact", label: "Please Contact" },
] as const;

export interface SearchFilters {
  q: string;
  category?: string;
  cities: string[];
  minPrice?: number;
  maxPrice?: number;
  types: string[];
  posted: string;
  sort: SortValue;
  page: number;
}

export interface ListingRow {
  id: string;
  title: string;
  price: Prisma.Decimal | null;
  priceType: string;
  category: string;
  subcategory: string | null;
  city: string;
  neighbourhood: string | null;
  images: string[];
  boostLevel: string;
  boostExpiresAt: Date | null;
  createdAt: Date;
  views: number;
  effectiveBoost: number;
}

export interface SearchResult {
  rows: ListingRow[];
  total: number;
  /** True when full-text found too little and trigram matching was used. */
  usedFallback: boolean;
}

/**
 * Parses raw URL search params into filters.
 *
 * Every field degrades rather than throws: search URLs are user-editable and
 * shareable, so /search must never return a 500 no matter what is typed into
 * the address bar. Unknown categories and cities are dropped, malformed numbers
 * are ignored, and the page number is clamped.
 */
export function parseSearchParams(
  params: Record<string, string | string[] | undefined>,
): SearchFilters {
  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  const many = (v: string | string[] | undefined): string[] => {
    if (v === undefined) return [];
    const arr = Array.isArray(v) ? v : [v];
    // Support both repeated params (?city=a&city=b) and comma-separated.
    return arr.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
  };

  const num = (v: string | undefined): number | undefined => {
    if (v === undefined || v.trim() === "") return undefined;
    const n = Number(v);
    // Reject NaN, Infinity and negatives rather than passing them to SQL.
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const rawQ = (one(params.q) ?? "").trim().slice(0, 100);

  const categorySlug = one(params.category);
  const category = getCategory(categorySlug)?.slug;

  const cities = validCitySlugs(many(params.city));

  let minPrice = num(one(params.minPrice));
  let maxPrice = num(one(params.maxPrice));
  // An inverted range would silently return nothing; swap instead.
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const validTypes = new Set(TYPE_OPTIONS.map((t) => t.value as string));
  const types = many(params.type).filter((t) => validTypes.has(t));

  const postedRaw = one(params.posted) ?? "any";
  const posted = POSTED_OPTIONS.some((p) => p.value === postedRaw)
    ? postedRaw
    : "any";

  const sortRaw = one(params.sort) ?? "newest";
  const sort = (
    SORT_OPTIONS.some((s) => s.value === sortRaw) ? sortRaw : "newest"
  ) as SortValue;

  const pageRaw = Number(one(params.page) ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return { q: rawQ, category, cities, minPrice, maxPrice, types, posted, sort, page };
}

/** Serialises filters back to a query string, preserving all but `page`. */
export function buildSearchUrl(
  filters: Partial<SearchFilters>,
  overrides: Partial<SearchFilters> = {},
): string {
  const f = { ...filters, ...overrides };
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  for (const c of f.cities ?? []) p.append("city", c);
  if (f.minPrice !== undefined) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice !== undefined) p.set("maxPrice", String(f.maxPrice));
  for (const t of f.types ?? []) p.append("type", t);
  if (f.posted && f.posted !== "any") p.set("posted", f.posted);
  if (f.sort && f.sort !== "newest") p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

/**
 * Effective boost rank. Ordering must not trust boostLevel alone: boosts are
 * downgraded by a nightly cron (Phase 3), so between a boost lapsing and that
 * job running, a listing still carries a stale boostLevel. Checking
 * boostExpiresAt here keeps expired boosts out of the top slots regardless.
 */
const EFFECTIVE_BOOST = Prisma.sql`
  CASE
    WHEN "boostExpiresAt" IS NULL OR "boostExpiresAt" <= now() THEN 3
    WHEN "boostLevel" = 'super'    THEN 0
    WHEN "boostLevel" = 'featured' THEN 1
    WHEN "boostLevel" = 'top'      THEN 2
    ELSE 3
  END
`;

/** Only active, unexpired listings are ever publicly visible. */
const VISIBLE = Prisma.sql`"status" = 'active' AND "expiresAt" > now()`;

function filterConditions(f: SearchFilters): Prisma.Sql[] {
  const conds: Prisma.Sql[] = [VISIBLE];

  if (f.category) conds.push(Prisma.sql`"category" = ${f.category}`);

  if (f.cities.length > 0) {
    conds.push(Prisma.sql`"city" IN (${Prisma.join(f.cities)})`);
  }

  // Price bounds apply only to listings that actually have a price. A "Please
  // contact" ad has no price and should not be swept into a price range.
  if (f.minPrice !== undefined) {
    conds.push(Prisma.sql`"price" IS NOT NULL AND "price" >= ${f.minPrice}`);
  }
  if (f.maxPrice !== undefined) {
    conds.push(Prisma.sql`"price" IS NOT NULL AND "price" <= ${f.maxPrice}`);
  }

  if (f.types.length > 0) {
    conds.push(Prisma.sql`"priceType" IN (${Prisma.join(f.types)})`);
  }

  const days: Record<string, number> = { today: 1, "7d": 7, "30d": 30 };
  if (f.posted in days) {
    conds.push(
      Prisma.sql`"createdAt" >= now() - ${`${days[f.posted]} days`}::interval`,
    );
  }

  return conds;
}

function orderBy(f: SearchFilters, relevance: Prisma.Sql | null): Prisma.Sql {
  // Boosted listings lead in every sort mode — that is what advertisers pay
  // for, and the product spec requires it.
  switch (f.sort) {
    case "price-asc":
      return Prisma.sql`${EFFECTIVE_BOOST}, "price" ASC NULLS LAST, "createdAt" DESC`;
    case "price-desc":
      return Prisma.sql`${EFFECTIVE_BOOST}, "price" DESC NULLS LAST, "createdAt" DESC`;
    default:
      return relevance
        ? Prisma.sql`${EFFECTIVE_BOOST}, ${relevance} DESC, "createdAt" DESC`
        : Prisma.sql`${EFFECTIVE_BOOST}, "createdAt" DESC`;
  }
}

const SELECT_COLUMNS = Prisma.sql`
  "id", "title", "price", "priceType", "category", "subcategory",
  "city", "neighbourhood", "images", "boostLevel", "boostExpiresAt",
  "createdAt", "views",
  ${EFFECTIVE_BOOST} AS "effectiveBoost"
`;
// NOTE: "postalCode" is deliberately absent and must stay absent. It is never
// exposed publicly.

export async function searchListings(f: SearchFilters): Promise<SearchResult> {
  const conds = filterConditions(f);
  const offset = (f.page - 1) * PAGE_SIZE;

  // No keyword: plain filtered browse, no text matching at all.
  if (!f.q) {
    const where = Prisma.join(conds, " AND ");
    const [rows, countRows] = await Promise.all([
      db.$queryRaw<ListingRow[]>`
        SELECT ${SELECT_COLUMNS} FROM "Listing"
        WHERE ${where}
        ORDER BY ${orderBy(f, null)}
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `,
      db.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM "Listing" WHERE ${where}
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
    db.$queryRaw<ListingRow[]>`
      SELECT ${SELECT_COLUMNS} FROM "Listing"
      WHERE ${ftsWhere}
      ORDER BY ${orderBy(f, rank)}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "Listing" WHERE ${ftsWhere}
    `,
  ]);

  const total = Number(ftsCount[0].count);
  if (total >= FALLBACK_THRESHOLD || f.page > 1) {
    return { rows: ftsRows, total, usedFallback: false };
  }

  // Fallback: trigram matching against the title, for misspellings that
  // full-text search cannot resolve. Runs in a transaction so SET LOCAL cannot
  // leak the lowered threshold onto other pooled connections.
  const trgmWhere = Prisma.join(
    [...conds, Prisma.sql`${f.q} <% "title"`],
    " AND ",
  );
  const wsim = Prisma.sql`word_similarity(${f.q}, "title")`;

  const [, trgmRows, trgmCount] = await db.$transaction([
    db.$executeRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(
      WORD_SIMILARITY_THRESHOLD,
    )}, true)`,
    db.$queryRaw<ListingRow[]>`
      SELECT ${SELECT_COLUMNS} FROM "Listing"
      WHERE ${trgmWhere}
      ORDER BY ${orderBy(f, wsim)}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "Listing" WHERE ${trgmWhere}
    `,
  ]);

  const trgmTotal = Number(trgmCount[0].count);
  // Only prefer the fallback if it genuinely found more.
  if (trgmTotal > total) {
    return { rows: trgmRows, total: trgmTotal, usedFallback: true };
  }
  return { rows: ftsRows, total, usedFallback: false };
}

/**
 * Homepage "Recently posted": strictly newest first, with no boost weighting.
 * Boost ordering belongs in search results; applying it here would just repeat
 * the featured strip directly underneath itself, which is what it did before.
 */
export async function recentListings(limit = 12): Promise<ListingRow[]> {
  return db.$queryRaw<ListingRow[]>`
    SELECT ${SELECT_COLUMNS} FROM "Listing"
    WHERE ${VISIBLE}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
}

/** Homepage featured strip: super-boosted listings whose boost is still live. */
export async function featuredListings(limit = 6): Promise<ListingRow[]> {
  return db.$queryRaw<ListingRow[]>`
    SELECT ${SELECT_COLUMNS} FROM "Listing"
    WHERE ${VISIBLE}
      AND "boostLevel" = 'super'
      AND "boostExpiresAt" IS NOT NULL
      AND "boostExpiresAt" > now()
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
  `;
}

/** Listing detail page: same category and city, excluding the listing itself. */
export async function similarListings(
  listingId: string,
  category: string,
  city: string,
  limit = 4,
): Promise<ListingRow[]> {
  return db.$queryRaw<ListingRow[]>`
    SELECT ${SELECT_COLUMNS} FROM "Listing"
    WHERE ${VISIBLE}
      AND "category" = ${category}
      AND "city" = ${city}
      AND "id" <> ${listingId}
    ORDER BY ${EFFECTIVE_BOOST}, "createdAt" DESC
    LIMIT ${limit}
  `;
}

/** Category counts for the homepage grid. */
export async function categoryCounts(): Promise<Record<string, number>> {
  const rows = await db.$queryRaw<{ category: string; count: bigint }[]>`
    SELECT "category", COUNT(*) AS count FROM "Listing"
    WHERE ${VISIBLE}
    GROUP BY "category"
  `;
  return Object.fromEntries(rows.map((r) => [r.category, Number(r.count)]));
}
