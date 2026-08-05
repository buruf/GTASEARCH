import Link from "next/link";
import { TorontoSkyline } from "@/components/TorontoSkyline";
import { CategoryIcon } from "@/components/CategoryIcon";
import { BusinessGrid } from "@/components/BusinessCard";
import { ListingGrid } from "@/components/ListingCard";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { CITIES, cityRank } from "@/lib/cities";
import {
  businessCityCounts,
  businessCountsByCategory,
  newestBusinesses,
} from "@/lib/business";
import { recentListings } from "@/lib/search";
import { currentUserId } from "@/lib/auth";
import { savedIdsFor } from "@/lib/saved";

// Aug 2026 pivot: the directory is the site's front door — this page is the
// former /directory hub promoted to `/` (the old classifieds homepage moved
// to /classifieds, and /directory now redirects here). Renders dynamically on
// every request (the layout Header reads the session), so no revalidate
// window applies.

// Chip labels are the marquee subcategory for each linked category page —
// chips deep-link to the parent category page, not a subcategory filter.
// Curated for a mature, evenly filled directory; today's DB is heavily
// skewed, so these are filtered against live counts below — an empty chip
// would just dead-end the user on a "no businesses found" page.
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

// Circular tinted icon backgrounds, one tone per category — the flat green
// icons read as a single undifferentiated block at grid size. Full class
// strings, not interpolated, because Tailwind only ships classes it can see
// literally in the source.
const CATEGORY_TONE: Record<string, string> = {
  restaurants: "bg-amber-50 text-amber-700",
  health: "bg-rose-50 text-rose-700",
  "home-services": "bg-sky-50 text-sky-700",
  beauty: "bg-fuchsia-50 text-fuchsia-700",
  automotive: "bg-blue-50 text-blue-700",
  professional: "bg-indigo-50 text-indigo-700",
  shopping: "bg-teal-50 text-teal-700",
  education: "bg-orange-50 text-orange-700",
  fitness: "bg-cyan-50 text-cyan-700",
  pets: "bg-pink-50 text-pink-700",
  // Neutral slate, matching the deliberately non-denominational icon — a
  // tinted colour here would read as favouring one tradition.
  religion: "bg-slate-100 text-slate-700",
};

export default async function HomePage() {
  const [counts, cityCounts, recent, recentAds, viewerId] = await Promise.all([
    businessCountsByCategory(),
    businessCityCounts(),
    newestBusinesses(8),
    recentListings(4),
    currentUserId(),
  ]);
  const savedIds = viewerId
    ? await savedIdsFor(viewerId, recentAds.map((l) => l.id))
    : undefined;

  const totalBusinesses = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const liveCategories = Object.values(counts).filter((n) => n > 0).length;
  const citiesWithBusinesses = CITIES.map((city) => ({
    city,
    count: cityCounts[city.slug] ?? 0,
  }))
    .filter((c) => c.count > 0)
    // Canonical order (largest municipality first), NOT listing count — our
    // count per city reflects what each municipality publishes, so ranking by
    // it claimed Markham is a bigger commercial centre than Toronto. See the
    // header of lib/cities.ts.
    .sort((a, b) => cityRank(a.city.slug) - cityRank(b.city.slug));

  return (
    <>
      {/* Sky gradient + illustrated Toronto skyline. Text sits on the light
          upper sky, so contrast stays WCAG-clean; the search card is solid
          white and reads fine over the buildings. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#D9EAF8] via-[#E9F3FB] to-[#F4F9FD]">
        <TorontoSkyline className="pointer-events-none absolute bottom-0 left-0 h-36 w-full sm:h-52" />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-10 text-center sm:pb-32 sm:pt-14">
          <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
            The local search engine for the{" "}
            <span className="text-brand-dark">Greater Toronto Area</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-muted sm:text-lg">
            Restaurants, salons, daycares, trades and more — plus local
            classifieds. Everything local, one search.
          </p>

          <form
            action="/directory/search"
            method="GET"
            role="search"
            className="mx-auto mt-8 flex w-full max-w-4xl flex-col gap-2 rounded-card bg-surface p-2.5 shadow-card-hover sm:flex-row sm:items-stretch"
          >
            <div className="flex-1">
              <label htmlFor="directory-q" className="sr-only">
                Search businesses
              </label>
              <input
                id="directory-q"
                type="search"
                name="q"
                list="popular-searches"
                placeholder="Search businesses…"
                className="h-14 w-full rounded-btn border border-line px-4 text-lg text-ink placeholder:text-ink-faint focus:border-brand"
              />
              {/* A native datalist: type-ahead suggestions with no JavaScript,
                  no client bundle and no extra request. Entries are terms the
                  directory can actually answer today — suggesting "Roofers"
                  while home-services is empty would just teach people the
                  search is broken. Extend as curation fills categories. */}
              <datalist id="popular-searches">
                <option value="Restaurants" />
                <option value="Pizza" />
                <option value="Hair salon" />
                <option value="Barber" />
                <option value="Nail salon" />
                <option value="Tattoo" />
                <option value="Daycare" />
                <option value="Auto repair" />
                <option value="Driving school" />
              </datalist>
            </div>

            <div className="sm:w-48">
              <label htmlFor="directory-category" className="sr-only">
                Category
              </label>
              <select
                id="directory-category"
                name="category"
                className="h-14 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink focus:border-brand"
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
                className="h-14 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink focus:border-brand"
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
              className="h-14 rounded-btn bg-brand px-8 text-lg font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Search
            </button>
          </form>

          {/* Credibility strip. Every figure is counted from the live
              database at render time — no rounded-up marketing numbers, and
              nothing here claims traffic, reviews or city coverage we do not
              actually have yet. "Toronto" is stated plainly because that is
              genuinely where the directory data currently is. */}
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
            <li>
              <strong className="font-semibold text-ink">
                {totalBusinesses.toLocaleString("en-CA")}
              </strong>{" "}
              businesses listed
            </li>
            <li>
              <strong className="font-semibold text-ink">{liveCategories}</strong> live
              categories
            </li>
            <li>
              <strong className="font-semibold text-ink">
                {citiesWithBusinesses.length}
              </strong>{" "}
              cities
            </li>
            <li>
              Built from{" "}
              <Link
                href="/data-sources"
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                GTA municipal open data
              </Link>
            </li>
          </ul>

          <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
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
                      className="flex h-full flex-col items-center gap-2 rounded-card border border-line bg-surface p-4 text-center transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-card-hover"
                    >
                      <span
                        className={`flex h-14 w-14 items-center justify-center rounded-full ${
                          CATEGORY_TONE[c.slug] ?? "bg-brand-50 text-brand"
                        }`}
                      >
                        <CategoryIcon name={c.icon} className="h-9 w-9" />
                      </span>
                      <span className="text-xs font-semibold leading-tight text-ink sm:text-sm">
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

        {/* Browse by city. Count-gated like every other cross-link on the
            site: a city with no businesses is not shown at all rather than
            offered as a link to an empty page. Grows on its own as regional
            imports land. */}
        {citiesWithBusinesses.length > 0 && (
          <section aria-labelledby="cities-heading" className="mt-12">
            <h2 id="cities-heading" className="text-lg font-bold text-ink sm:text-xl">
              Browse by city
            </h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {citiesWithBusinesses.map(({ city, count }) => (
                <li key={city.slug}>
                  <Link
                    href={`/directory/search?city=${city.slug}`}
                    className="flex items-baseline gap-2 rounded-card border border-line bg-surface px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-card-hover"
                  >
                    <span className="text-sm font-semibold text-ink">{city.label}</span>
                    <span className="text-xs text-ink-faint">
                      {count.toLocaleString("en-CA")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

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

        {/* Business-owner CTA. Deliberately makes no promise we cannot keep:
            self-serve claiming is Phase 5B, so this routes to contact rather
            than advertising a signup flow that does not exist yet. */}
        <section aria-labelledby="owners-heading" className="mt-12">
          <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-alt p-5 text-center sm:p-6">
            <h2 id="owners-heading" className="text-lg font-bold text-ink sm:text-xl">
              Own a business in the GTA?
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-ink-muted">
              GTASearch is built from public records, so your business may
              already be listed. Tell us about it and we&apos;ll add or correct
              your details — free.
            </p>
            <div>
              <Link
                href="/contact"
                className="inline-block rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Add or update your business
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="classifieds-heading" className="mt-12">
          <div className="rounded-card border border-line bg-brand-50 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="classifieds-heading"
                  className="text-lg font-bold text-ink sm:text-xl"
                >
                  Buy &amp; sell in the classifieds
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Free local listings — cars, furniture, electronics, jobs and
                  more, posted by people across the GTA.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/classifieds"
                  className="rounded-btn border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-surface"
                >
                  Browse classifieds
                </Link>
                <Link
                  href="/post-ad"
                  className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Post Ad
                </Link>
              </div>
            </div>
            {recentAds.length > 0 && (
              <div className="mt-5">
                <ListingGrid
                  listings={recentAds}
                  priorityCount={0}
                  savedIds={savedIds}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
