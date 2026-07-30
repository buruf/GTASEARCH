import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getPublicListing } from "@/lib/listing";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { NewMessageForm } from "./NewMessageForm";

export const metadata: Metadata = { title: "New message", robots: { index: false } };

export default async function NewMessagePage({
  searchParams,
}: { searchParams: { listing?: string } }) {
  const userId = await requireUserId();
  const listing = await getPublicListing(searchParams.listing ?? "");
  if (!listing) notFound();
  if (listing.user.id === userId) redirect(`/listing/${listing.id}`);

  // Already talking? Jump straight into the thread instead of a blank form.
  const existing = await db.conversation.findUnique({
    where: { listingId_buyerId: { listingId: listing.id, buyerId: userId } },
    select: { id: true },
  });
  if (existing) redirect(`/messages/${existing.id}`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Message the seller</h1>
      <div className="mt-3 rounded-card border border-line bg-surface p-3 text-sm">
        <Link href={`/listing/${listing.id}`} className="font-medium text-brand hover:underline">
          {listing.title}
        </Link>
        <span className="text-ink-muted"> · {formatPrice(listing.price, listing.priceType)} · {listing.user.name}</span>
      </div>
      <div className="mt-4">
        <NewMessageForm listingId={listing.id} />
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        Stay safe: keep the conversation on GTASearch, meet in public, and never send deposits.
      </p>
    </div>
  );
}
