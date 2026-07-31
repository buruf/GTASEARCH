import Image from "next/image";
import Link from "next/link";
import { formatPrice, formatRelativeTime, type PriceInput } from "@/lib/format";
import { firstIncompleteStep, stepPath } from "@/lib/draft";
import { stripeEnabled } from "@/lib/env";
import { markSoldAction, relistAction, deleteAction } from "./actions";
import { DeleteButton } from "./DeleteButton";

export interface MyAdRowListing {
  id: string;
  title: string;
  price: PriceInput;
  priceType: string;
  status: string;
  images: string[];
  views: number;
  createdAt: Date;
  expiresAt: Date;
  category: string;
  description: string;
  city: string;
}

type DisplayStatus = "draft" | "active" | "sold" | "expired";

const CHIP_CLASS: Record<DisplayStatus, string> = {
  active: "bg-brand-50 text-brand",
  sold: "bg-surface-alt text-ink-muted",
  expired: "bg-amber-50 text-amber-700",
  draft: "ring-1 ring-line text-ink-muted",
};

const CHIP_LABEL: Record<DisplayStatus, string> = {
  active: "Active",
  sold: "Sold",
  expired: "Expired",
  draft: "Draft",
};

function displayStatus(listing: MyAdRowListing): DisplayStatus {
  if (listing.status === "draft") return "draft";
  if (listing.status === "sold") return "sold";
  // The nightly cron (spec §6) now flips stored status to "expired" once
  // expiresAt passes — show it the same as the derived case below.
  if (listing.status === "expired") return "expired";
  // A listing left in "active" past its expiry is shown as Expired even
  // before the cron catches up and flips the stored status.
  if (listing.status === "active" && listing.expiresAt.getTime() < Date.now()) return "expired";
  return "active";
}

const actionButton =
  "rounded-btn border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand hover:text-brand";

export function MyAdRow({ listing }: { listing: MyAdRowListing }) {
  const status = displayStatus(listing);
  const cover = listing.images[0];
  const isDraft = status === "draft";
  const titleHref = isDraft ? stepPath(firstIncompleteStep(listing)) : `/listing/${listing.id}`;

  return (
    <div className="flex items-start gap-3 p-4">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-btn bg-surface-alt">
        {cover ? (
          <Image src={cover} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-[10px] text-ink-faint">
            No photo
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <Link href={titleHref} className="text-sm font-semibold text-ink hover:text-brand">
          {isDraft ? "Continue draft" : listing.title}
        </Link>
        <p className="mt-0.5 text-sm text-ink-muted">{formatPrice(listing.price, listing.priceType)}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          <span className={`rounded-btn px-2 py-0.5 font-semibold ${CHIP_CLASS[status]}`}>
            {CHIP_LABEL[status]}
          </span>
          {!isDraft && <span>{listing.views} view{listing.views === 1 ? "" : "s"}</span>}
          <span>Posted {formatRelativeTime(listing.createdAt)}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {!isDraft && (
          <Link href={`/listing/${listing.id}/edit`} className={actionButton}>
            Edit
          </Link>
        )}
        {status === "active" && listing.expiresAt.getTime() > Date.now() && stripeEnabled() && (
          <Link href={`/listing/${listing.id}/boost`} className={actionButton}>
            Boost
          </Link>
        )}
        {status === "active" && (
          <form action={markSoldAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <button type="submit" className={actionButton}>Mark sold</button>
          </form>
        )}
        {(status === "sold" || status === "expired") && (
          <form action={relistAction}>
            <input type="hidden" name="listingId" value={listing.id} />
            <button type="submit" className={actionButton}>Relist</button>
          </form>
        )}
        <DeleteButton listingId={listing.id} action={deleteAction} />
      </div>
    </div>
  );
}
