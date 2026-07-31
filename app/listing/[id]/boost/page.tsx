import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripeEnabled } from "@/lib/env";
import { BOOST_TIERS, effectiveBoostOf, type BoostTierKey } from "@/lib/boost";
import { BoostPicker } from "./BoostPicker";

export const metadata: Metadata = {
  title: "Boost this ad",
  robots: { index: false },
};

function boostStatusLabel(boostLevel: string, boostExpiresAt: Date | null): string {
  const rank = effectiveBoostOf(boostLevel, boostExpiresAt);
  if (rank === 3 || !boostExpiresAt) return "No active boost";
  const tier = BOOST_TIERS[boostLevel as BoostTierKey];
  const daysLeft = Math.max(1, Math.ceil((boostExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  return `Currently boosted: ${tier?.label ?? boostLevel}, ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

export default async function BoostListingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { cancelled?: string };
}) {
  const userId = await requireUserId();

  const listing = await db.listing.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      status: true,
      expiresAt: true,
      boostLevel: true,
      boostExpiresAt: true,
      userId: true,
    },
  });
  if (
    !listing ||
    listing.userId !== userId ||
    listing.status !== "active" ||
    listing.expiresAt <= new Date()
  ) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Boost this ad</h1>
      <p className="mt-1 text-sm text-ink-muted">{listing.title}</p>
      <p className="mt-3 text-sm font-medium text-ink">
        {boostStatusLabel(listing.boostLevel, listing.boostExpiresAt)}
      </p>

      {searchParams.cancelled && (
        <p className="mt-4 rounded-card bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Checkout cancelled — no charge was made.
        </p>
      )}

      {!stripeEnabled() ? (
        <div className="mt-6 rounded-card border border-line p-5">
          <p className="text-sm text-ink-muted">Payments aren&apos;t configured yet. Check back soon.</p>
          <Link href={`/listing/${listing.id}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
            Back to your listing
          </Link>
        </div>
      ) : (
        <BoostPicker listingId={listing.id} />
      )}
    </div>
  );
}
