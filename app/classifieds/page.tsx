import type { Metadata } from "next";
import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { PhotoHero } from "@/components/PhotoHero";
import { CategoryGrid } from "@/components/CategoryGrid";
import { ListingGrid } from "@/components/ListingCard";
import { categoryCounts, featuredListings, recentListings } from "@/lib/search";
import { currentUserId } from "@/lib/auth";
import { savedIdsFor } from "@/lib/saved";

export const metadata: Metadata = {
  title: "GTA Classifieds — Buy & Sell Locally",
  description:
    "Free classifieds for the Greater Toronto Area. Browse cars, real estate, jobs, electronics, furniture and more across Toronto, Mississauga, Brampton, Markham and the wider GTA.",
  alternates: { canonical: "/classifieds" },
};

// The pre-flip homepage, relocated: since the directory took over `/`
// (Aug 2026 pivot), this is the classifieds section's landing page.

export default async function ClassifiedsPage() {
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
      {/* Same photographic hero as the directory. Classifieds used to sit on
          an illustrated skyline over a pale blue gradient — the pre-pivot
          design — so the two halves of the site looked unrelated. */}
      <PhotoHero>
        <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm [text-wrap:balance] sm:text-5xl">
          Buy, sell, and find anything in the{" "}
          <span className="text-brand-light">Greater Toronto Area</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white sm:text-lg">
          Free local listings across Toronto, Mississauga, Brampton, Markham
          and every city in the GTA.
        </p>
        <div className="mt-8">
          <SearchBar variant="hero" />
        </div>
      </PhotoHero>

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
