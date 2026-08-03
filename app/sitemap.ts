import type { MetadataRoute } from "next";
import { allVisibleListingIds } from "@/lib/listing";
import { CATEGORIES } from "@/lib/categories";
import { CITIES } from "@/lib/cities";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { businessCityCounts } from "@/lib/business";
import { db } from "@/lib/db";

const BASE = "https://gtasearch.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, categoryCityCounts, activeBusinesses] = await Promise.all([
    allVisibleListingIds(),
    // One businessCityCounts() call per category — the directory taxonomy is
    // a fixed, small (ten-entry) constant, so this stays cheap.
    Promise.all(
      BUSINESS_CATEGORIES.map(async (c) => ({
        category: c.slug,
        counts: await businessCityCounts(c.slug),
      })),
    ),
    db.business.findMany({
      where: { status: "active" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    {
      url: BASE,
      changeFrequency: "hourly",
      priority: 1,
    },
    // The classifieds section landing page (the pre-flip homepage).
    {
      url: `${BASE}/classifieds`,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    },
    {
      url: `${BASE}/data-sources`,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    },
    { url: `${BASE}/terms`, changeFrequency: "yearly" as const, priority: 0.2 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly" as const, priority: 0.2 },
    { url: `${BASE}/about`, changeFrequency: "yearly" as const, priority: 0.3 },
    { url: `${BASE}/contact`, changeFrequency: "yearly" as const, priority: 0.3 },
    // Category and city landing pages: these are the filtered views worth
    // indexing. Arbitrary filter permutations are noindexed on /search itself.
    ...CATEGORIES.map((c) => ({
      url: `${BASE}/search?category=${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...CITIES.map((c) => ({
      url: `${BASE}/search?city=${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...listings.map((l) => ({
      url: `${BASE}/listing/${l.id}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Directory category and category/city browse pages — these are the
    // indexable directory URLs; the hub itself is now the homepage (first
    // entry above; /directory 308s there) and /directory/search is
    // noindexed, same rule as /search above.
    ...BUSINESS_CATEGORIES.map((c) => ({
      url: `${BASE}/directory/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...categoryCityCounts.flatMap(({ category, counts }) =>
      Object.entries(counts)
        .filter(([, count]) => count >= 1)
        .map(([city]) => ({
          url: `${BASE}/directory/${category}/${city}`,
          changeFrequency: "daily" as const,
          priority: 0.6,
        })),
    ),
    ...activeBusinesses.map((b) => ({
      url: `${BASE}/biz/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
