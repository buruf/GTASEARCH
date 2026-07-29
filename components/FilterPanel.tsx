import { CATEGORIES } from "@/lib/categories";
import { CITIES } from "@/lib/cities";
import {
  POSTED_OPTIONS,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  type SearchFilters,
} from "@/lib/search";

/**
 * A plain GET form. Every control is a native input whose `name` matches what
 * parseSearchParams reads, so submitting produces exactly the URL the results
 * page expects — with JavaScript disabled included. A later enhancement can
 * auto-submit on change without restructuring any of this.
 */
export function FilterPanel({ filters }: { filters: SearchFilters }) {
  return (
    <form action="/search" method="GET" className="space-y-6">
      {/* Preserve the keyword across filter changes. */}
      {filters.q && <input type="hidden" name="q" value={filters.q} />}

      <fieldset>
        <legend className="text-sm font-semibold text-ink">Category</legend>
        <select
          name="category"
          defaultValue={filters.category ?? ""}
          className="mt-2 h-10 w-full rounded-btn border border-line bg-surface px-2 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">City</legend>
        <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {CITIES.map((c) => (
            <label key={c.slug} className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                name="city"
                value={c.slug}
                defaultChecked={filters.cities.includes(c.slug)}
                className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">Price (CAD)</legend>
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor="minPrice" className="sr-only">
            Minimum price
          </label>
          <input
            id="minPrice"
            type="number"
            inputMode="numeric"
            min="0"
            name="minPrice"
            placeholder="Min"
            defaultValue={filters.minPrice ?? ""}
            className="h-10 w-full rounded-btn border border-line px-2 text-sm"
          />
          <span className="text-ink-faint" aria-hidden="true">
            –
          </span>
          <label htmlFor="maxPrice" className="sr-only">
            Maximum price
          </label>
          <input
            id="maxPrice"
            type="number"
            inputMode="numeric"
            min="0"
            name="maxPrice"
            placeholder="Max"
            defaultValue={filters.maxPrice ?? ""}
            className="h-10 w-full rounded-btn border border-line px-2 text-sm"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">Listing type</legend>
        <div className="mt-2 space-y-1.5">
          {TYPE_OPTIONS.map((t) => (
            <label key={t.value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                name="type"
                value={t.value}
                defaultChecked={filters.types.includes(t.value)}
                className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">Date posted</legend>
        <div className="mt-2 space-y-1.5">
          {POSTED_OPTIONS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="radio"
                name="posted"
                value={p.value}
                defaultChecked={filters.posted === p.value}
                className="h-4 w-4 border-line text-brand focus:ring-brand"
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">Sort by</legend>
        <select
          name="sort"
          defaultValue={filters.sort}
          className="mt-2 h-10 w-full rounded-btn border border-line bg-surface px-2 text-sm"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          className="h-10 flex-1 rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Apply filters
        </button>
        <a
          href="/search"
          className="flex h-10 items-center justify-center rounded-btn border border-line px-3 text-sm font-medium text-ink-muted hover:border-brand hover:text-brand"
        >
          Clear
        </a>
      </div>
    </form>
  );
}
