// "Near me" — businesses closest to a point.
//
// Two-step by design. A bounding box first, because that is the part an index
// can serve (Business_coordinates_idx), and only then the true great-circle
// distance on whatever survives the box. Computing haversine across all 55,318
// rows would be a sequential scan on every search — the same shape of mistake
// that caused the 2026-08-28 connection-pool incident.
//
// Businesses with no coordinates never appear here. That is deliberate and is
// stated on the page: a missing pin is honest, a guessed one sends somebody to
// the wrong street.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getBusinessCategory } from "@/lib/business-categories";

export const NEAR_PAGE_SIZE = 24;

/** Kilometres per degree of latitude. Longitude shrinks with latitude, so the
 *  longitude span is divided by cos(lat) — at Toronto's 43.7° a degree of
 *  longitude is only about 80km, and using 111 for both would search a box
 *  roughly 40% too narrow east-west. */
const KM_PER_DEG_LAT = 111.045;

export interface NearbyBusiness {
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string | null;
  city: string;
  address: string;
  phone: string | null;
  images: string[];
  verified: boolean;
  distanceKm: number;
}

export interface NearOptions {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  category?: string;
  /** Free-text name search, e.g. "shoppers drug mart". */
  q?: string;
  page?: number;
}

/** Rejects anything outside the GTA, and anything non-finite. A swapped
 *  lat/lng or a stray NaN from a query string must never reach SQL. */
export function isPlausibleGtaPoint(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 42 && lat <= 45.5 && lng >= -81.5 && lng <= -77;
}

/**
 * Parses coordinates from user-editable query params.
 *
 * Returns null rather than throwing, and null rather than clamping: a point
 * outside the GTA is a mistake or someone travelling, and silently snapping it
 * to Toronto would show them results hundreds of kilometres away as though
 * they were nearby.
 */
export function parseNearParams(params: {
  lat?: string;
  lng?: string;
  radius?: string;
}): { latitude: number; longitude: number; radiusKm: number } | null {
  const latitude = Number(params.lat);
  const longitude = Number(params.lng);
  if (!isPlausibleGtaPoint(latitude, longitude)) return null;

  const raw = Number(params.radius);
  // 1–25km. Beyond 25km "nearby" stops meaning anything in a region this
  // dense, and the bounding box stops being selective enough to be fast.
  const radiusKm = Number.isFinite(raw) ? Math.min(25, Math.max(1, raw)) : 5;
  return { latitude, longitude, radiusKm };
}

export async function nearbyBusinesses(
  opts: NearOptions,
): Promise<{ rows: NearbyBusiness[]; total: number }> {
  const { latitude, longitude } = opts;
  if (!isPlausibleGtaPoint(latitude, longitude)) return { rows: [], total: 0 };

  const radiusKm = Math.min(25, Math.max(1, opts.radiusKm ?? 5));
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const offset = (page - 1) * NEAR_PAGE_SIZE;

  // Category is validated against the taxonomy rather than interpolated, so an
  // unknown value degrades to "all categories" instead of erroring.
  const category = opts.category && getBusinessCategory(opts.category) ? opts.category : null;

  const latDelta = radiusKm / KM_PER_DEG_LAT;
  const lngDelta = radiusKm / (KM_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180));

  const categoryFilter = category ? Prisma.sql`AND category = ${category}` : Prisma.empty;

  const term = opts.q?.trim();
  // Trigram similarity is applied ONLY to single-word terms. On a multi-word
  // query it matches any one word: "halal food" scored highly against "Tigers
  // Korean Food" on the word "food" alone, putting a Korean restaurant at the
  // top of a halal search.
  //
  // The tsvector itself now carries the category label (migration
  // 20260829120000), so a generic word like "food" is satisfied by what the
  // business IS and the distinctive word does the filtering. That replaced an
  // inline per-row to_tsvector here — same behaviour, one mechanism.
  const singleWord = term ? !/\s/.test(term) : false;
  const textFilter =
    term && term.length >= 2
      ? Prisma.sql`AND (
          "searchVector" @@ websearch_to_tsquery('english', ${term})
          OR name ILIKE ${"%" + term + "%"}
          ${singleWord ? Prisma.sql`OR word_similarity(${term}, name) > 0.55` : Prisma.empty}
        )`
      : Prisma.empty;

  // Haversine. Distance is computed once in the CTE and reused for both the
  // radius filter and the ordering, so it is never calculated twice per row.
  const withDistance = Prisma.sql`
    SELECT
      id, slug, name, category, subcategory, city, address, phone, images, verified,
      2 * 6371 * asin(sqrt(
        power(sin(radians(latitude - ${latitude}) / 2), 2)
        + cos(radians(${latitude})) * cos(radians(latitude))
        * power(sin(radians(longitude - ${longitude}) / 2), 2)
      )) AS "distanceKm"
    FROM "Business"
    WHERE status = 'active'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND latitude BETWEEN ${latitude - latDelta} AND ${latitude + latDelta}
      AND longitude BETWEEN ${longitude - lngDelta} AND ${longitude + lngDelta}
      ${categoryFilter}
      ${textFilter}
  `;

  // ONE round trip, not two. A separate COUNT query would re-run the same
  // bounding-box scan and, with connection_limit=1, queue behind this one on
  // the single connection. COUNT(*) OVER() is evaluated across the whole
  // filtered set before LIMIT applies, so the total is exact.
  const rows = await db.$queryRaw<(NearbyBusiness & { total: bigint })[]>(Prisma.sql`
    WITH nearby AS (${withDistance})
    SELECT *, COUNT(*) OVER()::bigint AS total
    FROM nearby
    WHERE "distanceKm" <= ${radiusKm}
    -- id as a final tiebreak: two businesses at one address have identical
    -- distances, and without it they shuffle between pages.
    ORDER BY "distanceKm" ASC, id ASC
    LIMIT ${NEAR_PAGE_SIZE} OFFSET ${offset}
  `);

  const total = rows.length ? Number(rows[0].total) : 0;
  return {
    rows: rows.map(({ total: _total, ...b }) => b),
    total,
  };
}

/** How much of the directory can answer a distance search at all. Shown on the
 *  page so the coverage gap is stated rather than hidden. */
export async function coordinateCoverage(): Promise<{ located: number; total: number }> {
  const [located, total] = await Promise.all([
    db.business.count({ where: { status: "active", latitude: { not: null } } }),
    db.business.count({ where: { status: "active" } }),
  ]);
  return { located, total };
}

/** "450 m" under a kilometre, "1.2 km" above — never "0.45 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
