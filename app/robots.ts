import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep crawlers out of the API and off placeholder pages. /search itself
      // stays crawlable so category and city links are followed, but the page
      // sets robots noindex on filtered permutations.
      disallow: ["/api/", "/coming-soon"],
    },
    sitemap: "https://gtasearch.com/sitemap.xml",
  };
}
