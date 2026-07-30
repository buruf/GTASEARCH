import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { cloudinaryConfig } from "@/lib/env";
import { EditForms, StatusChip, type DisplayStatus } from "./EditForms";

export const metadata: Metadata = {
  title: "Edit ad",
  robots: { index: false },
};

function displayStatus(status: string, expiresAt: Date): DisplayStatus {
  if (status === "draft") return "draft";
  if (status === "sold") return "sold";
  // Mirrors MyAdRow's dashboard treatment: "active" past expiry reads as
  // Expired even though nothing has flipped the stored status (no cron yet).
  if (status === "active" && expiresAt.getTime() < Date.now()) return "expired";
  return "active";
}

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = await requireUserId();

  // Owner-only page — the one legitimate read of postalCode, which every
  // public-facing query must otherwise omit.
  const listing = await db.listing.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      status: true,
      expiresAt: true,
      title: true,
      description: true,
      priceType: true,
      price: true,
      city: true,
      neighbourhood: true,
      postalCode: true,
      images: true,
    },
  });
  if (!listing || listing.status === "deleted" || listing.userId !== userId) notFound();

  const cfg = cloudinaryConfig();
  const status = displayStatus(listing.status, listing.expiresAt);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Edit ad</h1>
      <div className="mt-2">
        <StatusChip status={status} />
      </div>

      <EditForms
        listingId={listing.id}
        status={status}
        details={{
          title: listing.title,
          description: listing.description,
          priceType: listing.priceType,
          price: listing.price?.toString() ?? "",
        }}
        location={{
          city: listing.city,
          neighbourhood: listing.neighbourhood ?? "",
          postalCode: listing.postalCode ?? "",
        }}
        images={listing.images}
        cloudinary={cfg}
      />
    </div>
  );
}
