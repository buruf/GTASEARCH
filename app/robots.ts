import type { MetadataRoute } from "next";

/**
 * Commercial SEO and AI-scraping crawlers. They index the site to sell
 * competitor-analysis products or harvest training data, send no visitors
 * back, and crawl hard — a 55,000-page directory is exactly the sort of target
 * they hammer. Blocked after an 18x edge-request spike on 2026-09-04.
 *
 * Search engines that actually send traffic (Google, Bing, DuckDuckGo, Apple)
 * are deliberately untouched by this list.
 *
 * robots.txt is a request, not a control. A crawler that ignores it has to be
 * stopped at Vercel's firewall instead.
 */
const PARASITIC_CRAWLERS = [
  "AhrefsBot",
  "SemrushBot",
  "DotBot",
  "MJ12bot",
  "BLEXBot",
  "DataForSeoBot",
  "PetalBot",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Never useful to a crawler.
          "/api/",
          "/coming-soon",
          "/dashboard/",
          // Search-result permutations are effectively infinite and thin, and
          // already noindexed on the page itself. Crawling them burns budget
          // that should go on the 55,000 business pages.
          "/directory/search",
          // Renders nothing until the visitor grants geolocation, so there is
          // no content for a bot to find — only a wasted request.
          "/near-me",
        ],
      },
      ...PARASITIC_CRAWLERS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: "https://gtasearch.com/sitemap.xml",
  };
}
