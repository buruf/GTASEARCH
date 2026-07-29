import { CATEGORIES } from "@/lib/categories";
import { CITIES } from "@/lib/cities";

interface Props {
  defaultQuery?: string;
  defaultCategory?: string;
  defaultCity?: string;
  /** "hero" is the large homepage variant; "compact" sits in the header. */
  variant?: "hero" | "compact";
}

/**
 * A plain GET form. No JavaScript, no client state — submitting navigates to
 * /search with the values as query parameters, which is exactly the URL shape
 * the results page already parses. Works with JS disabled and is shareable.
 */
export function SearchBar({
  defaultQuery = "",
  defaultCategory = "",
  defaultCity = "",
  variant = "hero",
}: Props) {
  const hero = variant === "hero";

  return (
    <form
      action="/search"
      method="GET"
      role="search"
      className={
        hero
          ? "flex w-full flex-col gap-2 rounded-card bg-surface p-2 shadow-card sm:flex-row sm:items-stretch"
          : "flex w-full items-stretch gap-2"
      }
    >
      <div className={hero ? "flex-1" : "flex-1 min-w-0"}>
        <label htmlFor={`q-${variant}`} className="sr-only">
          Search keyword
        </label>
        <input
          id={`q-${variant}`}
          type="search"
          name="q"
          defaultValue={defaultQuery}
          placeholder="What are you looking for?"
          className={`w-full rounded-btn border border-line px-3 text-ink placeholder:text-ink-faint focus:border-brand ${
            hero ? "h-12 text-base" : "h-10 text-sm"
          }`}
        />
      </div>

      <div className={hero ? "sm:w-48" : "hidden md:block md:w-40"}>
        <label htmlFor={`category-${variant}`} className="sr-only">
          Category
        </label>
        <select
          id={`category-${variant}`}
          name="category"
          defaultValue={defaultCategory}
          className={`w-full rounded-btn border border-line bg-surface px-3 text-ink focus:border-brand ${
            hero ? "h-12 text-base" : "h-10 text-sm"
          }`}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className={hero ? "sm:w-44" : "hidden lg:block lg:w-36"}>
        <label htmlFor={`city-${variant}`} className="sr-only">
          City
        </label>
        <select
          id={`city-${variant}`}
          name="city"
          defaultValue={defaultCity}
          className={`w-full rounded-btn border border-line bg-surface px-3 text-ink focus:border-brand ${
            hero ? "h-12 text-base" : "h-10 text-sm"
          }`}
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
        className={`rounded-btn bg-brand font-semibold text-white transition-colors hover:bg-brand-dark ${
          hero ? "h-12 px-6 text-base" : "h-10 px-4 text-sm"
        }`}
      >
        Search
      </button>
    </form>
  );
}
