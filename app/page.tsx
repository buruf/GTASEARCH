import Link from "next/link";
import Image from "next/image";
// Statically imported so Next knows the intrinsic size at build time and can
// generate the blur placeholder — neither works with a bare "/path" string.
import heroPhoto from "@/public/toronto-hero.jpg";
import { CategoryIcon } from "@/components/CategoryIcon";
import { BusinessGrid } from "@/components/BusinessCard";
import { ListingGrid } from "@/components/ListingCard";
import { EventGrid } from "@/components/EventCard";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import { CITIES, cityRank } from "@/lib/cities";
import {
  businessCityCounts,
  businessCountsByCategory,
  newestBusinesses,
} from "@/lib/business";
import { recentListings } from "@/lib/search";
import { soonestEvents } from "@/lib/events";
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
  const [counts, cityCounts, recent, recentAds, events, viewerId] = await Promise.all([
    businessCountsByCategory(),
    businessCityCounts(),
    newestBusinesses(8),
    recentListings(4),
    soonestEvents(4),
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
      {/* Hero: the owner's own aerial photograph of downtown Toronto, taken
          from a plane (so there is no licence question and no attribution to
          carry — see docs/data-sources or ask before ever swapping it for
          stock). It replaces the illustrated skyline, which read as a
          placeholder beside real photography.

          Contrast: the photo is bright at the top (sky and frozen lake) and
          busy everywhere, so white text on it would fail WCAG on its own. The
          scrim below is a fixed dark gradient, strongest exactly where the
          headline and subhead sit, which keeps white text well past AA no
          matter which part of the image a given viewport crops to. */}
      <section className="relative overflow-hidden bg-[#0B1F2E]">
        <Image
          src={heroPhoto}
          alt=""
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          // 55, not the 75 default, because this image is viewed through a
          // 60% black scrim that hides the compression artefacts which would
          // make 55 unacceptable on a photo shown plainly.
          //
          // It does NOT buy back the Lighthouse score, and it was wrong of me
          // to assume it would: measured on production, mobile performance is
          // 98 with LCP 2.3s at BOTH q=55 and q=72. The remaining half-second
          // is the round trip for an above-the-fold image at all, not its
          // weight. Kept anyway on the honest ground it does help — 69KB
          // versus 82KB at 828w, ~16% less to pull on a slow connection, even
          // though the score bucket does not move.
          quality={55}
          // Framing, worked out from the source rather than by eye. The hero
          // band is ~3.4:1 and the photo is 4:3, so object-cover shows only
          // about 39% of the image's height. In the original the CN Tower
          // spans roughly 31–51% down and the downtown core 39–59%; anchoring
          // at 65% put the visible window at 45–85%, which cut the tower off
          // at the top edge and filled the band with the residential grid.
          // 42% centres the window on the skyline itself.
          className="object-cover object-[center_42%]"
        />
        <div
          aria-hidden="true"
          // 60% is the floor, not a preference: against the brightest thing
          // the crop can put behind the subhead, it holds white text at about
          // 5.7:1, where 55% measured ~3.96:1 and failed the 4.5:1 AA floor.
          // Worst-case is the right test because the crop — and so what sits
          // behind the text — changes with every viewport.
          //
          // The top stop was 75%, which buried the photo: the whole point of
          // real photography is that you can tell it is Toronto. Dropped to
          // 60% so the lake and skyline read, which is safe because the only
          // thing up there is the h1, and large bold text needs 3:1, not 4.5.
          className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/60 to-black/70"
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-10 text-center sm:pb-32 sm:pt-14">
          {/* text-balance evens the two lines out; without it the break fell
              after "Greater", stranding it away from "Toronto Area". */}
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm [text-wrap:balance] sm:text-5xl">
            The local search engine for the{" "}
            <span className="text-brand-light">Greater Toronto Area</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white sm:text-lg">
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
                {/* Only cities that actually have businesses — NOT the full
                    CITIES list. Toronto's open data labels every downtown,
                    Scarborough and Etobicoke record alike as "toronto", so
                    those two can only ever return nothing here; Oakville and
                    Burlington likewise, until Halton publishes anything.
                    Offering a filter that is guaranteed to return no results
                    teaches people the search is broken.

                    CITIES itself is left alone deliberately: Scarborough and
                    Etobicoke are entirely real for CLASSIFIEDS, where someone
                    posting a sofa says Scarborough rather than Toronto, and
                    the post-ad wizard and listing filters still need them.
                    This list is derived from live counts, so a city appears
                    the moment it has data and disappears if it ever loses it. */}
                {citiesWithBusinesses.map(({ city }) => (
                  <option key={city.slug} value={city.slug}>
                    {city.label}
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
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/85">
            <li>
              <strong className="font-semibold text-white">
                {totalBusinesses.toLocaleString("en-CA")}
              </strong>{" "}
              businesses listed
            </li>
            <li>
              <strong className="font-semibold text-white">{liveCategories}</strong> live
              categories
            </li>
            <li>
              <strong className="font-semibold text-white">
                {citiesWithBusinesses.length}
              </strong>{" "}
              cities
            </li>
            <li>
              Built from{" "}
              <Link
                href="/data-sources"
                className="font-semibold text-white underline underline-offset-2 hover:text-brand-light"
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
                  // Solid white, not a translucent pill: a frosted chip over
                  // photography changes contrast with whatever is behind it,
                  // and this hero's backdrop shifts with every crop.
                  className="inline-block rounded-btn bg-white/95 px-3 py-1.5 text-xs font-medium text-ink shadow-sm hover:bg-white hover:text-brand-dark"
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
        {/* Gated on having any: an empty "Whats on" section reads as a
            broken feature, and the events feed can legitimately run dry. */}
        {events.length > 0 && (
          <section aria-labelledby="events-heading" className="mt-12">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="events-heading" className="text-lg font-bold text-ink sm:text-xl">
                What&apos;s on in the GTA
              </h2>
              <Link
                href="/events"
                className="text-sm font-medium text-brand hover:text-brand-dark"
              >
                All events
              </Link>
            </div>
            <div className="mt-4">
              <EventGrid events={events} />
            </div>
          </section>
        )}

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
