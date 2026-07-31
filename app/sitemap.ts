import type { MetadataRoute } from "next";
import { allVisibleListingIds } from "@/lib/listing";
import { CATEGORIES } from "@/lib/categories";
import { CITIES } from "@/lib/cities";

const BASE = "https://gtasearch.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const listings = await allVisibleListingIds();

  return [
    {
      url: BASE,
      changeFrequency: "hourly",
      priority: 1,
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
  ];
}
