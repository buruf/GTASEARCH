import Image from "next/image";
import Link from "next/link";
import type { ListingRow } from "@/lib/search";
import { formatPrice, formatRelativeTime } from "@/lib/format";
import { getCityLabel } from "@/lib/cities";

interface Props {
  listing: ListingRow;
  /** Renders the first few cards eagerly so the LCP image is not lazy-loaded. */
  priority?: boolean;
}

export function ListingCard({ listing, priority = false }: Props) {
  // effectiveBoost: 0 super, 1 featured, 2 top, 3 none/lapsed. Uses the
  // computed rank, not boostLevel, so a lapsed boost shows no badge.
  const isFeatured = listing.effectiveBoost <= 1;
  const cover = listing.images[0];

  return (
    <article
      className={`group relative overflow-hidden rounded-card bg-surface shadow-card transition-shadow hover:shadow-card-hover ${
        isFeatured ? "ring-2 ring-brand-light" : "ring-1 ring-line"
      }`}
    >
      <Link href={`/listing/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] bg-surface-alt">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              priority={priority}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-faint">
              No photo
            </div>
          )}

          {isFeatured && (
            <span className="absolute left-2 top-2 rounded-btn bg-brand px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
              Featured
            </span>
          )}
        </div>

        <div className="p-3">
          <p className="text-base font-bold text-brand-dark">
            {formatPrice(listing.price, listing.priceType)}
          </p>
          {/* The whole card is a link, so the heading carries the accessible
              name for the card rather than a nested anchor. */}
          <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight text-ink">
            {listing.title}
          </h3>
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
            <span>{getCityLabel(listing.city)}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={new Date(listing.createdAt).toISOString()}>
              {formatRelativeTime(listing.createdAt)}
            </time>
          </p>
        </div>
      </Link>
    </article>
  );
}

export function ListingGrid({
  listings,
  priorityCount = 4,
}: {
  listings: ListingRow[];
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:gap-4">
      {listings.map((l, i) => (
        <li key={l.id}>
          <ListingCard listing={l} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
