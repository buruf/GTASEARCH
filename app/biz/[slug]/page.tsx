import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageGallery } from "@/components/ImageGallery";
import { BusinessGrid } from "@/components/BusinessCard";
import { getBusiness, similarBusinesses } from "@/lib/business";
import { dealsForBusiness, dealTimeLeft } from "@/lib/deals";
import {
  getBusinessCategoryLabel,
  getBusinessSubcategoryLabel,
} from "@/lib/business-categories";
import { getCityLabel } from "@/lib/cities";
import { currentUserId } from "@/lib/auth";
import { averageRating, myReview, reviewsFor } from "@/lib/reviews";
import { Stars, ratingLabel } from "@/components/Stars";
import { ReviewForm } from "./reviews/ReviewForm";
import { OwnerReply } from "./reviews/OwnerReply";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const business = await getBusiness(params.slug);
  if (!business) return { title: "Business not found" };

  const categoryLabel = getBusinessCategoryLabel(business.category);
  const cityLabel = getCityLabel(business.city);
  const description = business.description.slice(0, 155);

  return {
    title: `${business.name} — ${categoryLabel} in ${cityLabel}`,
    description,
    alternates: { canonical: `/biz/${business.slug}` },
    openGraph: {
      title: `${business.name} — ${categoryLabel} in ${cityLabel}`,
      description,
      type: "article",
      url: `/biz/${business.slug}`,
      images: business.images[0] ? [{ url: business.images[0] }] : undefined,
    },
  };
}

export default async function BusinessProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const business = await getBusiness(params.slug);
  if (!business) notFound();

  const categoryLabel = getBusinessCategoryLabel(business.category);
  const subcategoryLabel = getBusinessSubcategoryLabel(
    business.category,
    business.subcategory,
  );
  const cityLabel = getCityLabel(business.city);

  const deals = await dealsForBusiness(business.id);
  const similar = await similarBusinesses(
    business.slug,
    business.category,
    business.city,
    4,
  );

  const viewerId = await currentUserId();
  const isOwner = Boolean(viewerId && business.claimedById === viewerId);
  const [reviews, mine] = await Promise.all([
    reviewsFor(business.id),
    viewerId && !isOwner ? myReview(business.id, viewerId) : Promise.resolve(null),
  ]);
  const reviewCount = business.reviewCount;
  const average = averageRating(business.ratingSum, reviewCount);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${business.name} ${business.address}`,
  )}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/directory/${business.category}`}
              className="hover:text-brand"
            >
              {categoryLabel}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/directory/${business.category}/${business.city}`}
              className="hover:text-brand"
            >
              {cityLabel}
            </Link>
          </li>
        </ol>
      </nav>

      <header>
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-ink sm:text-2xl">
          {business.name}
          {business.verified && (
            <span className="inline-flex items-center gap-1 rounded-btn bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-dark">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10 1.5 12.4 3l3-.4 1 2.8 2.8 1-.4 3L20 12l-1.2 2.6.4 3-2.8 1-1 2.8-3-.4L10 22.5l-2.4-1.5-3 .4-1-2.8-2.8-1 .4-3L0 12l1.2-2.6-.4-3 2.8-1 1-2.8 3 .4L10 1.5Zm4.3 6.6-5 5-2.3-2.3-1.4 1.4 3.7 3.7 6.4-6.4-1.4-1.4Z"
                />
              </svg>
              Verified
            </span>
          )}
        </h1>

        <p className="mt-1 text-sm text-ink-faint">
          {categoryLabel}
          {subcategoryLabel ? ` · ${subcategoryLabel}` : ""}
        </p>

        <dl className="mt-3 space-y-1.5 text-sm text-ink-muted">
          <div className="flex flex-wrap items-center gap-1.5">
            <dt className="sr-only">Address</dt>
            <dd>{business.address}</dd>
            <span aria-hidden="true">·</span>
            <dd>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand hover:text-brand-dark"
              >
                View on map
              </a>
            </dd>
          </div>

          {business.phone && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Phone</dt>
              <dd>
                <a
                  href={`tel:${business.phone}`}
                  className="font-medium text-brand hover:text-brand-dark"
                >
                  {business.phone}
                </a>
              </dd>
            </div>
          )}

          {business.website && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Website</dt>
              <dd>
                <a
                  href={business.website}
                  target="_blank"
                  rel="nofollow noopener"
                  className="font-medium text-brand hover:text-brand-dark"
                >
                  {business.website.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          )}

          {business.hours && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Hours</dt>
              <dd>{business.hours}</dd>
            </div>
          )}
        </dl>
      </header>

      {business.images.length > 0 && (
        <div className="mt-6">
          <ImageGallery images={business.images} title={business.name} />
        </div>
      )}

      {deals.length > 0 && (
        <section aria-labelledby="business-deals-heading" className="mt-8">
          <h2 id="business-deals-heading" className="text-lg font-bold text-ink">
            Current offers
          </h2>
          <ul className="mt-3 space-y-3">
            {deals.map((d) => (
              <li key={d.id} className="rounded-card border border-brand bg-brand-50 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{d.title}</p>
                  {dealTimeLeft(d.endsAt) && (
                    <span className="text-xs font-semibold text-brand-dark">
                      {dealTimeLeft(d.endsAt)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink-muted">{d.description}</p>
                {d.code && (
                  <p className="mt-2 text-xs text-ink-faint">
                    Code <span className="font-mono font-semibold text-ink">{d.code}</span>
                  </p>
                )}
                {/* The end date is always shown. An offer without one is how
                    people end up at a till holding an expired coupon. */}
                <p className="mt-1 text-xs text-ink-faint">
                  Ends {d.endsAt.toLocaleDateString("en-CA")} · posted by the business
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="business-description-heading" className="mt-6">
        <h2
          id="business-description-heading"
          className="text-base font-bold text-ink"
        >
          About
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
          {business.description}
        </p>
      </section>

      <section aria-labelledby="reviews-heading" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="reviews-heading" className="text-lg font-bold text-ink">
            Reviews
          </h2>
          {reviewCount > 0 && (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Stars rating={average ?? 0} />
              {/* The count always travels with the average — "5.0" from one
                  review must never look like "5.0" from two hundred. */}
              <span className="font-semibold text-ink">{average}</span>
              <span>
                from {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </span>
            </p>
          )}
        </div>
        <p className="sr-only">{ratingLabel(average, reviewCount)}</p>

        {reviews.length === 0 && (
          <p className="mt-3 text-sm text-ink-muted">
            No reviews yet. Every review here is written by a signed-in visitor
            — we never add our own.
          </p>
        )}

        {reviews.length > 0 && (
          <ul className="mt-4 space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stars rating={r.rating} />
                    <span className="text-sm font-semibold text-ink">{r.user.name}</span>
                  </div>
                  <span className="text-xs text-ink-faint">
                    {r.createdAt.toLocaleDateString("en-CA")}
                    {r.updatedAt.getTime() - r.createdAt.getTime() > 60_000 && " (edited)"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                  {r.body}
                </p>

                {r.ownerResponse && (
                  <div className="mt-3 rounded-card bg-surface-alt p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      Response from the owner
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">
                      {r.ownerResponse}
                    </p>
                  </div>
                )}

                {isOwner && (
                  <OwnerReply reviewId={r.id} slug={business.slug} existing={r.ownerResponse} />
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          {!viewerId ? (
            <p className="text-sm text-ink-muted">
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(`/biz/${business.slug}`)}`}
                className="font-medium text-brand hover:text-brand-dark"
              >
                Sign in
              </Link>{" "}
              to write a review.
            </p>
          ) : isOwner ? (
            <p className="text-sm text-ink-muted">
              You manage this business, so you cannot review it. You can reply to
              reviews above.
            </p>
          ) : (
            <ReviewForm slug={business.slug} existing={mine} />
          )}
        </div>
      </section>

      {!business.claimedById && (
        <div className="mt-6 rounded-card border border-line bg-surface-alt p-4">
          <h2 className="text-sm font-bold text-ink">Is this your business?</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Claim it free to correct the details, add photos and hours, and show
            a verified badge.
          </p>
          <Link
            href={`/biz/${business.slug}/claim`}
            className="mt-3 inline-block rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Claim this business
          </Link>
        </div>
      )}

      {similar.length > 0 && (
        <section aria-labelledby="similar-business-heading" className="mt-12">
          <h2 id="similar-business-heading" className="text-lg font-bold text-ink">
            More {categoryLabel} near {cityLabel}
          </h2>
          <div className="mt-4">
            <BusinessGrid businesses={similar} />
          </div>
        </section>
      )}
    </div>
  );
}
