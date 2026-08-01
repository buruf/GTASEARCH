import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageGallery } from "@/components/ImageGallery";
import { BusinessGrid } from "@/components/BusinessCard";
import { getBusiness, similarBusinesses } from "@/lib/business";
import {
  getBusinessCategoryLabel,
  getBusinessSubcategoryLabel,
} from "@/lib/business-categories";
import { getCityLabel } from "@/lib/cities";

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

  const similar = await similarBusinesses(
    business.slug,
    business.category,
    business.city,
    4,
  );

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
            <Link href="/directory" className="hover:text-brand">
              Directory
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

      <div className="mt-6 rounded-card border border-line bg-surface-alt p-4">
        <h2 className="text-sm font-bold text-ink">Is this your business?</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Claiming and updating your listing is coming soon. Meanwhile, for
          corrections, see our{" "}
          <Link href="/contact" className="font-medium text-brand hover:text-brand-dark">
            contact page
          </Link>
          .
        </p>
      </div>

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
