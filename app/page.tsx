import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { CategoryGrid } from "@/components/CategoryGrid";
import { ListingGrid } from "@/components/ListingCard";
import { categoryCounts, featuredListings, recentListings } from "@/lib/search";
import { currentUserId } from "@/lib/auth";
import { savedIdsFor } from "@/lib/saved";

// This route renders dynamically on every request (the layout Header reads the session), so no revalidate window applies.

export default async function HomePage() {
  const [counts, featured, recent, viewerId] = await Promise.all([
    categoryCounts(),
    featuredListings(6),
    recentListings(12),
    currentUserId(),
  ]);
  // Signed-out visitors get no hearts (undefined savedIds) — the detail page
  // is their entry point to favouriting.
  const savedIds = viewerId
    ? await savedIdsFor(viewerId, [...featured, ...recent].map((l) => l.id))
    : undefined;

  return (
    <>
      <section className="bg-brand-50">
        <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:py-14">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Buy, sell, and find anything in the{" "}
            <span className="text-brand">Greater Toronto Area</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-muted sm:text-base">
            Thousands of local listings across Toronto, Mississauga, Brampton,
            Markham and every city in the GTA.
          </p>
          <div className="mt-6">
            <SearchBar variant="hero" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <section aria-labelledby="categories-heading">
          <h2
            id="categories-heading"
            className="text-lg font-bold text-ink sm:text-xl"
          >
            Browse by category
          </h2>
          <div className="mt-4">
            <CategoryGrid counts={counts} />
          </div>
        </section>

        {featured.length > 0 && (
          <section aria-labelledby="featured-heading" className="mt-12">
            <div className="flex items-baseline justify-between gap-4">
              <h2
                id="featured-heading"
                className="text-lg font-bold text-ink sm:text-xl"
              >
                Featured listings
              </h2>
              <Link
                href="/search"
                className="text-sm font-medium text-brand hover:text-brand-dark"
              >
                See all
              </Link>
            </div>
            <div className="mt-4">
              <ListingGrid listings={featured} priorityCount={4} savedIds={savedIds} />
            </div>
          </section>
        )}

        <section aria-labelledby="recent-heading" className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="recent-heading"
              className="text-lg font-bold text-ink sm:text-xl"
            >
              Recently posted
            </h2>
            <Link
              href="/search"
              className="text-sm font-medium text-brand hover:text-brand-dark"
            >
              See all
            </Link>
          </div>
          <div className="mt-4">
            <ListingGrid listings={recent} priorityCount={0} savedIds={savedIds} />
          </div>
        </section>
      </div>
    </>
  );
}
