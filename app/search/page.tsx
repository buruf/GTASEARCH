import type { Metadata } from "next";
import Link from "next/link";
import { FilterPanel } from "@/components/FilterPanel";
import { ListingGrid } from "@/components/ListingCard";
import { Pagination } from "@/components/Pagination";
import {
  PAGE_SIZE,
  parseSearchParams,
  searchListings,
  type SearchFilters,
} from "@/lib/search";
import { getCategoryLabel } from "@/lib/categories";
import { getCityLabel } from "@/lib/cities";
import { currentUserId } from "@/lib/auth";
import { savedIdsFor } from "@/lib/saved";

type Params = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: "Search listings",
  // Filtered permutations are near-infinite and have no SEO value; the
  // category and city landing paths are what should be indexed.
  robots: { index: false, follow: true },
};

/** "247 results for "sofa" in Toronto" */
function describeResults(total: number, f: SearchFilters): string {
  const count = `${total.toLocaleString("en-CA")} ${total === 1 ? "result" : "results"}`;
  const parts: string[] = [count];
  if (f.q) parts.push(`for "${f.q}"`);
  if (f.category) parts.push(`in ${getCategoryLabel(f.category)}`);
  if (f.cities.length === 1) parts.push(`in ${getCityLabel(f.cities[0])}`);
  else if (f.cities.length > 1) parts.push(`in ${f.cities.length} cities`);
  return parts.join(" ");
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const filters = parseSearchParams(searchParams);
  const { rows, total, usedFallback } = await searchListings(filters);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const viewerId = await currentUserId();
  const savedIds = viewerId
    ? await savedIdsFor(viewerId, rows.map((r) => r.id))
    : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="lg:flex lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <h2 className="mb-4 text-base font-bold text-ink">Filters</h2>
          <FilterPanel filters={filters} />
        </aside>

        {/* Mobile drawer — a CSS-only disclosure, no JavaScript required. */}
        <details className="mb-4 rounded-card border border-line lg:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Filters and sorting
          </summary>
          <div className="border-t border-line p-4">
            <FilterPanel filters={filters} />
          </div>
        </details>

        <section className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-ink sm:text-xl">
            {describeResults(total, filters)}
          </h1>

          {usedFallback && (
            <p className="mt-2 rounded-card bg-brand-50 px-3 py-2 text-sm text-ink-muted">
              No exact matches for <strong>{filters.q}</strong> — showing
              closely spelled results instead.
            </p>
          )}

          {rows.length === 0 ? (
            <EmptyState filters={filters} />
          ) : (
            <>
              <div className="mt-5">
                <ListingGrid listings={rows} priorityCount={4} savedIds={savedIds} />
              </div>
              <Pagination filters={filters} totalPages={totalPages} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ filters }: { filters: SearchFilters }) {
  return (
    <div className="mt-6 rounded-card border border-line bg-surface-alt px-6 py-12 text-center">
      <p className="text-base font-semibold text-ink">Nothing matched</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
        {filters.q
          ? `We couldn't find any listings for "${filters.q}" with those filters.`
          : "No listings match those filters."}{" "}
        Try widening your search.
      </p>

      {/* Ten of the twelve classifieds categories have no ads at all, so the
          category tiles on /classifieds led straight here — and every escape
          route below ("search all of the GTA", "browse everything") led
          somewhere just as empty. When a whole category is bare, the honest
          answer is to say so and offer the only thing that changes it. */}
      {filters.category && (
        <p className="mx-auto mt-4 max-w-md text-sm text-ink-muted">
          Nobody has posted in <strong>{getCategoryLabel(filters.category)}</strong> yet.
        </p>
      )}
      <div className="mt-5">
        <Link
          href={filters.category ? `/post-ad?category=${filters.category}` : "/post-ad"}
          className="inline-block rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          {filters.category
            ? `Post the first ad in ${getCategoryLabel(filters.category)}`
            : "Post an ad"}
        </Link>
      </div>

      <ul className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
        {filters.cities.length > 0 && (
          <li>
            <Link
              href={`/search?${filters.q ? `q=${encodeURIComponent(filters.q)}` : ""}`}
              className="rounded-btn border border-line bg-surface px-3 py-1.5 text-ink hover:border-brand hover:text-brand"
            >
              Search all of the GTA
            </Link>
          </li>
        )}
        {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
          <li>
            <Link
              href={`/search?${new URLSearchParams({
                ...(filters.q ? { q: filters.q } : {}),
                ...(filters.category ? { category: filters.category } : {}),
              }).toString()}`}
              className="rounded-btn border border-line bg-surface px-3 py-1.5 text-ink hover:border-brand hover:text-brand"
            >
              Remove the price filter
            </Link>
          </li>
        )}
        <li>
          <Link
            href="/search"
            className="rounded-btn border border-line bg-surface px-3 py-1.5 text-ink hover:border-brand hover:text-brand"
          >
            Browse everything
          </Link>
        </li>
      </ul>
    </div>
  );
}
