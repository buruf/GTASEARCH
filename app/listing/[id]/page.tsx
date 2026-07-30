import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageGallery } from "@/components/ImageGallery";
import { ShareButtons } from "@/components/ShareButtons";
import { ViewCounter } from "@/components/ViewCounter";
import { ListingGrid } from "@/components/ListingCard";
import { currentUserId } from "@/lib/auth";
import { getPublicListing } from "@/lib/listing";
import { similarListings } from "@/lib/search";
import { getCategoryLabel, getSubcategoryLabel } from "@/lib/categories";
import { getCityLabel } from "@/lib/cities";
import {
  formatDate,
  formatMemberSince,
  formatPrice,
  formatRelativeTime,
} from "@/lib/format";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const listing = await getPublicListing(params.id);
  if (!listing) return { title: "Listing not found" };

  const price = formatPrice(listing.price, listing.priceType);
  const place = getCityLabel(listing.city);

  return {
    title: `${listing.title} — ${price} in ${place}`,
    description: listing.description.slice(0, 155),
    alternates: { canonical: `/listing/${listing.id}` },
    openGraph: {
      title: `${listing.title} — ${price}`,
      description: listing.description.slice(0, 155),
      type: "article",
      url: `/listing/${listing.id}`,
      // First image only: WhatsApp and most chat apps use just the first.
      images: listing.images[0] ? [{ url: listing.images[0] }] : undefined,
    },
  };
}

export default async function ListingPage({
  params,
}: {
  params: { id: string };
}) {
  const listing = await getPublicListing(params.id);
  if (!listing) notFound();

  const viewerId = await currentUserId();

  const similar = await similarListings(
    listing.id,
    listing.category,
    listing.city,
    4,
  );

  const subcategoryLabel = getSubcategoryLabel(
    listing.category,
    listing.subcategory,
  );
  const url = `https://gtasearch.com/listing/${listing.id}`;

  const disabledBtn =
    "w-full cursor-not-allowed rounded-btn border border-line bg-surface-alt px-4 py-2.5 text-sm font-semibold text-ink-faint";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <ViewCounter listingId={listing.id} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-brand">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/search?category=${listing.category}`} className="hover:text-brand">
              {getCategoryLabel(listing.category)}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/search?city=${listing.city}`} className="hover:text-brand">
              {getCityLabel(listing.city)}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="lg:flex lg:gap-8">
        <div className="min-w-0 lg:flex-1">
          <ImageGallery images={listing.images} title={listing.title} />

          <div className="mt-6">
            {listing.isFeatured && (
              <span className="mb-2 inline-block rounded-btn bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                Featured
              </span>
            )}
            <h1 className="text-xl font-bold text-ink sm:text-2xl">
              {listing.title}
            </h1>
            <p className="mt-2 text-2xl font-extrabold text-brand-dark">
              {formatPrice(listing.price, listing.priceType)}
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              {listing.neighbourhood ? `${listing.neighbourhood}, ` : ""}
              {getCityLabel(listing.city)}
              {" · "}
              <time dateTime={listing.createdAt.toISOString()}>
                Posted {formatRelativeTime(listing.createdAt)}
              </time>
              {" · "}
              {listing.views.toLocaleString("en-CA")} views
            </p>
            {subcategoryLabel && (
              <p className="mt-1 text-sm text-ink-faint">
                {getCategoryLabel(listing.category)} › {subcategoryLabel}
              </p>
            )}
          </div>

          <section aria-labelledby="description-heading" className="mt-6">
            <h2 id="description-heading" className="text-base font-bold text-ink">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {listing.description}
            </p>
          </section>

          <section className="mt-6">
            <h2 className="text-base font-bold text-ink">Share</h2>
            <div className="mt-2">
              <ShareButtons url={url} title={listing.title} />
            </div>
          </section>

          <details className="mt-6 rounded-card border border-line">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
              Safety tips
            </summary>
            <ul className="list-disc space-y-1.5 border-t border-line px-8 py-4 text-sm text-ink-muted">
              <li>Meet in a busy public place during daylight hours.</li>
              <li>Bring someone with you when collecting a large item.</li>
              <li>Inspect the item fully before paying anything.</li>
              <li>Pay in person. Never send a deposit or e-transfer in advance.</li>
              <li>
                Be wary of prices far below market value, and of anyone who
                refuses to meet in person.
              </li>
              <li>Never share banking details, SIN or copies of your ID.</li>
            </ul>
          </details>

          <p className="mt-4 text-sm">
            <Link href="/coming-soon" className="text-ink-muted underline hover:text-brand">
              Report this ad
            </Link>
          </p>
        </div>

        <aside className="mt-8 lg:mt-0 lg:w-80 lg:shrink-0">
          <div className="rounded-card border border-line p-4">
            <h2 className="text-base font-bold text-ink">Seller</h2>
            <p className="mt-2 font-medium text-ink">{listing.user.name}</p>
            <p className="text-sm text-ink-muted">
              Member since {formatMemberSince(listing.user.createdAt)}
            </p>
            <p className="text-sm text-ink-muted">
              {listing.activeAds} active{" "}
              {listing.activeAds === 1 ? "ad" : "ads"}
            </p>

            <div className="mt-4 space-y-2">
              {viewerId === listing.user.id ? (
                <Link href={`/listing/${listing.id}/edit`} className="block w-full rounded-btn bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-dark">
                  Edit your listing
                </Link>
              ) : (
                <Link
                  href={viewerId ? `/messages/new?listing=${listing.id}` : `/auth/signin?callbackUrl=${encodeURIComponent(`/messages/new?listing=${listing.id}`)}`}
                  className="block w-full rounded-btn bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Message seller
                </Link>
              )}
              {/* Deliberately inert until later tasks wire phone reveal and
                  favourites. Shown so the layout is final, but unmistakably inactive. */}
              <button type="button" className={disabledBtn} disabled title="Coming soon">
                Show phone number
              </button>
              <button type="button" className={disabledBtn} disabled title="Coming soon">
                ♥ Save to favourites
              </button>
            </div>
          </div>

          <p className="mt-4 px-1 text-xs text-ink-faint">
            Listed {formatDate(listing.createdAt)}
          </p>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar-heading" className="mt-12">
          <h2 id="similar-heading" className="text-lg font-bold text-ink">
            More in {getCategoryLabel(listing.category)} near{" "}
            {getCityLabel(listing.city)}
          </h2>
          <div className="mt-4">
            <ListingGrid listings={similar} priorityCount={0} />
          </div>
        </section>
      )}
    </div>
  );
}
