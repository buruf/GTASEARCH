import type { Metadata } from "next";
import Link from "next/link";
import { TorontoSkyline } from "@/components/TorontoSkyline";
import { CategoryIcon } from "@/components/CategoryIcon";
import { BusinessGrid } from "@/components/BusinessCard";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { CITIES } from "@/lib/cities";
import { businessCountsByCategory, newestBusinesses } from "@/lib/business";

export const metadata: Metadata = {
  title: "GTA Business Directory",
  description:
    "Find local businesses across the Greater Toronto Area — restaurants, health, home services, beauty, automotive and more.",
  alternates: { canonical: "/directory" },
};

// Chip labels are the marquee subcategory for each linked category page —
// resolved ambiguity from the Phase 5A plan: chips deep-link to the parent
// category page, not a subcategory filter. Curated for a mature, evenly
// filled directory; today's DB is heavily skewed (restaurants/automotive
// dominant, several categories still empty), so these are filtered against
// live counts below — an empty chip would just dead-end the user on a "no
// businesses found" page.
const POPULAR_CHIPS = [
  { label: "Dentists", category: "health" },
  { label: "Plumbers", category: "home-services" },
  { label: "Pizza", category: "restaurants" },
  { label: "Hair Salons", category: "beauty" },
  { label: "Auto Repair", category: "automotive" },
  { label: "Real Estate", category: "professional" },
];

/**
 * Filters POPULAR_CHIPS down to categories that actually have businesses,
 * then tops up from any other non-empty category (by count, so the busiest
 * still-unrepresented categories surface first) until at least 4 chips
 * remain — or fewer, if the DB genuinely doesn't have 4 non-empty categories
 * yet. Top-up chips use the category's own label since they have no
 * pre-curated marquee subcategory.
 */
function popularChips(
  counts: Record<string, number>,
): { label: string; href: string }[] {
  const survivors = POPULAR_CHIPS.filter(
    (chip) => (counts[chip.category] ?? 0) > 0,
  );
  const chips = survivors.map((chip) => ({
    label: chip.label,
    href: `/directory/${chip.category}`,
  }));

  if (chips.length >= 4) return chips;

  const usedSlugs = new Set(survivors.map((chip) => chip.category));
  const topUp = BUSINESS_CATEGORIES.filter(
    (c) => !usedSlugs.has(c.slug) && (counts[c.slug] ?? 0) > 0,
  )
    .sort(
      (a, b) =>
        (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, 4 - chips.length)
    .map((c) => ({ label: c.label, href: `/directory/${c.slug}` }));

  return [...chips, ...topUp];
}

export default async function DirectoryHubPage() {
  const [counts, recent] = await Promise.all([
    businessCountsByCategory(),
    newestBusinesses(8),
  ]);

  return (
    <>
      {/* Same sky-gradient + skyline treatment as the homepage hero, at a
          reduced height — this page sits one level down the hierarchy. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#D9EAF8] via-[#E9F3FB] to-[#F4F9FD]">
        <TorontoSkyline className="pointer-events-none absolute bottom-0 left-0 h-24 w-full sm:h-32" />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-10 text-center sm:pb-20 sm:pt-14">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Find local businesses across the{" "}
            <span className="text-brand-dark">GTA</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-muted sm:text-base">
            Restaurants, health, home services, beauty, automotive and more —
            addresses, phone numbers and websites in one place.
          </p>

          <form
            action="/directory/search"
            method="GET"
            role="search"
            className="mx-auto mt-6 flex w-full max-w-3xl flex-col gap-2 rounded-card bg-surface p-2 shadow-card sm:flex-row sm:items-stretch"
          >
            <div className="flex-1">
              <label htmlFor="directory-q" className="sr-only">
                Search businesses
              </label>
              <input
                id="directory-q"
                type="search"
                name="q"
                placeholder="Search businesses…"
                className="h-12 w-full rounded-btn border border-line px-3 text-base text-ink placeholder:text-ink-faint focus:border-brand"
              />
            </div>

            <div className="sm:w-48">
              <label htmlFor="directory-category" className="sr-only">
                Category
              </label>
              <select
                id="directory-category"
                name="category"
                className="h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink focus:border-brand"
              >
                <option value="">All categories</option>
                {BUSINESS_CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:w-44">
              <label htmlFor="directory-city" className="sr-only">
                City
              </label>
              <select
                id="directory-city"
                name="city"
                className="h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink focus:border-brand"
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
              className="h-12 rounded-btn bg-brand px-6 text-base font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Search
            </button>
          </form>

          <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {popularChips(counts).map((chip) => (
              <li key={chip.href}>
                <Link
                  href={chip.href}
                  className="inline-block rounded-btn border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand hover:text-brand"
                >
                  {chip.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <section aria-labelledby="directory-categories-heading">
          <h2
            id="directory-categories-heading"
            className="text-lg font-bold text-ink sm:text-xl"
          >
            Browse by category
          </h2>
          <div className="mt-4">
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {BUSINESS_CATEGORIES.map((c) => {
                const count = counts[c.slug] ?? 0;
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/directory/${c.slug}`}
                      className="flex h-full flex-col items-center gap-2 rounded-card border border-line bg-surface p-3 text-center transition-colors hover:border-brand hover:bg-brand-50"
                    >
                      <span className="text-brand">
                        <CategoryIcon name={c.icon} className="h-7 w-7" />
                      </span>
                      <span className="text-xs font-medium leading-tight text-ink sm:text-sm">
                        {c.label}
                      </span>
                      <span className="mt-auto text-[11px] text-ink-faint">
                        {count} {count === 1 ? "business" : "businesses"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {recent.length > 0 && (
          <section aria-labelledby="directory-recent-heading" className="mt-12">
            <h2
              id="directory-recent-heading"
              className="text-lg font-bold text-ink sm:text-xl"
            >
              Recently added
            </h2>
            <div className="mt-4">
              <BusinessGrid businesses={recent} />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
