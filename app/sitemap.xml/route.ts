import {
  businessChunkCount,
  renderIndex,
  SITEMAP_CACHE_HEADERS,
} from "@/lib/sitemap";

// A sitemap INDEX, not the sitemap itself. The single-file version carried
// 55,828 URLs — past Google's 50,000 limit, at which point the whole file can
// be rejected and none of the directory gets submitted.
export const revalidate = 3600;

export async function GET() {
  const chunks = await businessChunkCount();
  const paths = [
    "/sitemaps/core.xml",
    ...Array.from({ length: chunks }, (_, i) => `/sitemaps/biz-${i}.xml`),
  ];
  return new Response(renderIndex(paths), { headers: SITEMAP_CACHE_HEADERS });
}
