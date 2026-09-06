// Sitemap assembly, split into chunks.
//
// This replaced a single app/sitemap.ts that emitted every URL in one file.
// Three things were wrong with that, found while investigating an 18x edge
// request spike on 2026-09-04:
//
//   1. 55,828 URLs in one file. Google's limit is 50,000 URLs (and 50MB
//      uncompressed) per sitemap — over it, the file can be rejected whole,
//      which would mean none of the directory was being submitted at all.
//   2. No caching. The response carried `max-age=0, must-revalidate` despite
//      `export const revalidate = 3600`, so every crawler fetch re-ran the
//      full query set: 10MB and 7.7 seconds, measured on production.
//   3. Every business row was loaded to build it, on a database whose pool
//      allows one connection per instance.
//
// Now: a small index at /sitemap.xml pointing at chunks, each chunk fetched
// with skip/take so no single request loads the whole table, and cache headers
// that let the CDN answer crawlers without touching the database.

import { allVisibleListingIds } from "@/lib/listing";
import { CATEGORIES } from "@/lib/categories";
import { CITIES } from "@/lib/cities";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { businessCityCounts } from "@/lib/business";
import { db } from "@/lib/db";

export const BASE = "https://gtasearch.com";

/** URLs per chunk. Well under Google's 50,000 so there is room to grow before
 *  this needs revisiting, and small enough that a chunk stays a few MB. */
export const SITEMAP_CHUNK_SIZE = 20_000;

export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: string;
  priority?: number;
}

/**
 * Everything that is not a business: static pages, the classifieds category
 * and city landing pages, live listings, directory browse pages and events.
 * A few hundred URLs, so it stays one chunk.
 */
export async function coreEntries(): Promise<SitemapEntry[]> {
  const [listings, categoryCityCounts, liveEvents] = await Promise.all([
    allVisibleListingIds(),
    Promise.all(
      BUSINESS_CATEGORIES.map(async (c) => ({
        category: c.slug,
        counts: await businessCityCounts(c.slug),
      })),
    ),
    // Only events that have not finished. Submitting dead URLs is how a site
    // teaches a search engine its sitemap is unreliable.
    db.event.findMany({
      where: { status: "published", endsAt: { gte: new Date() } },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    { url: BASE, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/events`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/near-me`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/deals`, changeFrequency: "daily", priority: 0.6 },
    { url: `${BASE}/classifieds`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${BASE}/data-sources`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/about`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/contact`, changeFrequency: "yearly", priority: 0.3 },
    ...CATEGORIES.map((c) => ({
      url: `${BASE}/search?category=${c.slug}`,
      changeFrequency: "daily",
      priority: 0.8,
    })),
    ...CITIES.map((c) => ({
      url: `${BASE}/search?city=${c.slug}`,
      changeFrequency: "daily",
      priority: 0.7,
    })),
    ...listings.map((l) => ({
      url: `${BASE}/listing/${l.id}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    })),
    ...BUSINESS_CATEGORIES.map((c) => ({
      url: `${BASE}/directory/${c.slug}`,
      changeFrequency: "daily",
      priority: 0.7,
    })),
    // Count-gated: a category/city page with no businesses is a thin page,
    // and submitting it invites a crawl that finds nothing.
    ...categoryCityCounts.flatMap(({ category, counts }) =>
      Object.entries(counts)
        .filter(([, count]) => count >= 1)
        .map(([city]) => ({
          url: `${BASE}/directory/${category}/${city}`,
          changeFrequency: "daily",
          priority: 0.6,
        })),
    ),
    ...liveEvents.map((e) => ({
      url: `${BASE}/events/${e.slug}`,
      lastModified: e.updatedAt,
      changeFrequency: "weekly",
      priority: 0.5,
    })),
  ];
}

export async function businessChunkCount(): Promise<number> {
  const total = await db.business.count({ where: { status: "active" } });
  return Math.max(1, Math.ceil(total / SITEMAP_CHUNK_SIZE));
}

/**
 * One page of business URLs.
 *
 * Ordered by id so the pages are stable between requests — without a
 * deterministic order, skip/take can repeat or drop rows as the table
 * changes, which is the same pagination bug this project already fixed on
 * the browse pages.
 */
export async function businessChunk(index: number): Promise<SitemapEntry[]> {
  const rows = await db.business.findMany({
    where: { status: "active" },
    select: { slug: true, updatedAt: true },
    orderBy: { id: "asc" },
    skip: index * SITEMAP_CHUNK_SIZE,
    take: SITEMAP_CHUNK_SIZE,
  });
  return rows.map((b) => ({
    url: `${BASE}/biz/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: "weekly",
    priority: 0.5,
  }));
}

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export function renderUrlset(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.url)}</loc>`];
      if (e.lastModified) parts.push(`    <lastmod>${e.lastModified.toISOString()}</lastmod>`);
      if (e.changeFrequency) parts.push(`    <changefreq>${e.changeFrequency}</changefreq>`);
      if (e.priority !== undefined) parts.push(`    <priority>${e.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderIndex(paths: string[]): string {
  const now = new Date().toISOString();
  const items = paths
    .map((p) => `  <sitemap>\n    <loc>${escapeXml(`${BASE}${p}`)}</loc>\n    <lastmod>${now}</lastmod>\n  </sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

/**
 * Let the CDN answer crawlers.
 *
 * The old sitemap sent `max-age=0, must-revalidate`, so every bot fetch cost a
 * full rebuild. An hour of shared cache with a day of stale-while-revalidate
 * means a crawl storm hits Vercel's edge, not the database.
 */
export const SITEMAP_CACHE_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
} as const;
