import { notFound } from "next/navigation";
import {
  businessChunk,
  businessChunkCount,
  coreEntries,
  renderUrlset,
  SITEMAP_CACHE_HEADERS,
} from "@/lib/sitemap";

export const revalidate = 3600;

/**
 * One sitemap chunk: `/sitemaps/core.xml` or `/sitemaps/biz-<n>.xml`.
 *
 * The chunk name is validated against the real chunk count rather than
 * trusted — otherwise `/sitemaps/biz-9999.xml` would run a pointless
 * skip/take against the business table for anyone who asked, on a pool that
 * allows one connection per instance.
 */
export async function GET(
  _req: Request,
  { params }: { params: { chunk: string } },
) {
  const name = params.chunk.replace(/\.xml$/, "");

  if (name === "core") {
    return new Response(renderUrlset(await coreEntries()), {
      headers: SITEMAP_CACHE_HEADERS,
    });
  }

  const match = /^biz-(\d+)$/.exec(name);
  if (!match) notFound();

  const index = Number(match[1]);
  if (index >= (await businessChunkCount())) notFound();

  return new Response(renderUrlset(await businessChunk(index)), {
    headers: SITEMAP_CACHE_HEADERS,
  });
}
