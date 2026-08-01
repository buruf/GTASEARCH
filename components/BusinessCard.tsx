import Image from "next/image";
import Link from "next/link";
import type { BusinessRow } from "@/lib/business";
import {
  getBusinessCategoryLabel,
  getBusinessSubcategoryLabel,
} from "@/lib/business-categories";

export function BusinessCard({ business }: { business: BusinessRow }) {
  const cover = business.images[0];
  const subcategoryLabel = getBusinessSubcategoryLabel(
    business.category,
    business.subcategory,
  );

  return (
    <article className="group relative overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line transition-shadow hover:shadow-card-hover">
      <Link href={`/biz/${business.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-surface-alt">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-brand-50 text-3xl font-bold text-brand">
              {business.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="p-3">
          {/* h2, not h3: browse pages place cards directly under the page h1,
              and an h1→h3 skip fails the heading-order accessibility audit. */}
          <h2 className="flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {business.name}
            </span>
            {business.verified && (
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0 text-brand"
                aria-label="Verified business"
              >
                <title>Verified business</title>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10 1.5 12.4 3l3-.4 1 2.8 2.8 1-.4 3L20 12l-1.2 2.6.4 3-2.8 1-1 2.8-3-.4L10 22.5l-2.4-1.5-3 .4-1-2.8-2.8-1 .4-3L0 12l1.2-2.6-.4-3 2.8-1 1-2.8 3 .4L10 1.5Zm4.3 6.6-5 5-2.3-2.3-1.4 1.4 3.7 3.7 6.4-6.4-1.4-1.4Z"
                />
              </svg>
            )}
          </h2>
          <p className="mt-1 truncate text-xs text-ink-muted">
            {getBusinessCategoryLabel(business.category)}
            {subcategoryLabel ? ` · ${subcategoryLabel}` : ""}
          </p>
          <p className="mt-1 truncate text-xs text-ink-faint">
            {business.address}
          </p>
        </div>
      </Link>

      {business.phone && (
        // Sibling of the Link, not a descendant: the SaveHeart lesson
        // (components/ListingCard.tsx) — an interactive element nested
        // inside the card's anchor is invalid and still gets swallowed by
        // the anchor's own navigation on click. Positioned on top of the
        // image visually via absolute + the article's own `relative`, but
        // outside the anchor in the DOM so a tap lands only on the call
        // button. Tab order also becomes link -> call, the right a11y order.
        <a
          href={`tel:${business.phone}`}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-brand shadow-sm ring-1 ring-line hover:bg-brand-50"
          aria-label={`Call ${business.name}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />
          </svg>
        </a>
      )}
    </article>
  );
}

export function BusinessGrid({ businesses }: { businesses: BusinessRow[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:gap-4">
      {businesses.map((b) => (
        <li key={b.id}>
          <BusinessCard business={b} />
        </li>
      ))}
    </ul>
  );
}
