import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicListing } from "@/lib/listing";
import { ReportForm } from "./ReportForm";

export const metadata: Metadata = { title: "Report this ad", robots: { index: false } };

export default async function ReportListingPage({
  params,
}: { params: { id: string } }) {
  const listing = await getPublicListing(params.id);
  if (!listing) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Report this ad</h1>
      <div className="mt-3 rounded-card border border-line bg-surface p-3 text-sm">
        <Link href={`/listing/${listing.id}`} className="font-medium text-brand hover:underline">
          {listing.title}
        </Link>
      </div>
      <div className="mt-4">
        <ReportForm listingId={listing.id} />
      </div>
    </div>
  );
}
