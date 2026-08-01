import type { Metadata } from "next";
import { BusinessGrid } from "@/components/BusinessCard";
import { DirectoryPagination } from "../_components/DirectoryPagination";
import {
  BUSINESS_PAGE_SIZE,
  parseBusinessSearchParams,
  searchBusinesses,
  type BusinessSearchFilters,
} from "@/lib/business";
import { BUSINESS_CATEGORIES, getBusinessCategoryLabel } from "@/lib/business-categories";
import { CITIES, getCityLabel } from "@/lib/cities";

type Params = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: "Search the business directory",
  // Filtered permutations are near-infinite and have no SEO value; the
  // category and category/city landing paths are what should be indexed —
  // same rule as the classifieds /search page.
  robots: { index: false, follow: true },
};

/** "42 businesses for "sofa" in Home Services in Brampton" */
function describeResults(total: number, f: BusinessSearchFilters): string {
  const count = `${total.toLocaleString("en-CA")} ${total === 1 ? "business" : "businesses"}`;
  const parts: string[] = [count];
  if (f.q) parts.push(`for "${f.q}"`);
  if (f.category) parts.push(`in ${getBusinessCategoryLabel(f.category)}`);
  if (f.city) parts.push(`in ${getCityLabel(f.city)}`);
  return parts.join(" ");
}

function buildDirectorySearchUrl(
  filters: BusinessSearchFilters,
  overrides: Partial<BusinessSearchFilters> = {},
): string {
  const f = { ...filters, ...overrides };
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.city) p.set("city", f.city);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const qs = p.toString();
  return qs ? `/directory/search?${qs}` : "/directory/search";
}

export default async function DirectorySearchPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const filters = parseBusinessSearchParams(searchParams);
  const { rows, total, usedFallback } = await searchBusinesses(filters);
  const totalPages = Math.max(1, Math.ceil(total / BUSINESS_PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="lg:flex lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <h2 className="mb-4 text-base font-bold text-ink">Filters</h2>
          <DirectoryFilterForm filters={filters} />
        </aside>

        {/* Mobile drawer — a CSS-only disclosure, no JavaScript required. */}
        <details className="mb-4 rounded-card border border-line lg:hidden">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Filters
          </summary>
          <div className="border-t border-line p-4">
            <DirectoryFilterForm filters={filters} />
          </div>
        </details>

        <section className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-ink sm:text-xl">
            {describeResults(total, filters)}
          </h1>

          {usedFallback && (
            <p className="mt-2 rounded-card bg-brand-50 px-3 py-2 text-sm text-ink-muted">
              No exact name matches — showing closely matching businesses
              instead.
            </p>
          )}

          {rows.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">
              {filters.q
                ? `We couldn't find any businesses for "${filters.q}" with those filters.`
                : "No businesses match those filters."}
            </p>
          ) : (
            <>
              <div className="mt-5">
                <BusinessGrid businesses={rows} />
              </div>
              <DirectoryPagination
                page={Math.min(filters.page, totalPages)}
                totalPages={totalPages}
                buildHref={(p) => buildDirectorySearchUrl(filters, { page: p })}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function DirectoryFilterForm({ filters }: { filters: BusinessSearchFilters }) {
  return (
    <form action="/directory/search" method="GET" className="space-y-4">
      <div>
        <label
          htmlFor="directory-search-q"
          className="mb-1 block text-xs font-semibold text-ink-muted"
        >
          Keyword
        </label>
        <input
          id="directory-search-q"
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Business name…"
          className="h-10 w-full rounded-btn border border-line px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand"
        />
      </div>

      <div>
        <label
          htmlFor="directory-search-category"
          className="mb-1 block text-xs font-semibold text-ink-muted"
        >
          Category
        </label>
        <select
          id="directory-search-category"
          name="category"
          defaultValue={filters.category ?? ""}
          className="h-10 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink focus:border-brand"
        >
          <option value="">All categories</option>
          {BUSINESS_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="directory-search-city"
          className="mb-1 block text-xs font-semibold text-ink-muted"
        >
          City
        </label>
        <select
          id="directory-search-city"
          name="city"
          defaultValue={filters.city ?? ""}
          className="h-10 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink focus:border-brand"
        >
          <option value="">All GTA</option>
          {CITIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="h-10 w-full rounded-btn bg-brand text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        Apply filters
      </button>
    </form>
  );
}
