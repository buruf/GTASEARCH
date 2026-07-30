"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { DetailsFields } from "@/components/wizard/DetailsFields";
import { LocationFields } from "@/components/wizard/LocationFields";
import { PhotoUploader } from "@/components/wizard/PhotoUploader";
import { SubmitButton } from "@/components/wizard/SubmitButton";
import { DeleteButton } from "@/app/dashboard/DeleteButton";
import { markSoldAction, relistAction, deleteAction } from "@/app/dashboard/actions";
import type { FormState } from "@/app/auth/actions";
import { updateDetails, updateLocation, updatePhotos } from "./actions";

export type DisplayStatus = "draft" | "active" | "sold" | "expired";

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

const card = "mt-6 rounded-card border border-line bg-surface p-5 shadow-card";
const actionButton =
  "rounded-btn border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand";

export function StatusChip({ status }: { status: DisplayStatus }) {
  return (
    <span className={`inline-block rounded-btn px-2 py-0.5 text-xs font-semibold ${CHIP_CLASS[status]}`}>
      {CHIP_LABEL[status]}
    </span>
  );
}

export function EditForms({
  listingId,
  status,
  details,
  location,
  images,
  cloudinary,
}: {
  listingId: string;
  status: DisplayStatus;
  details: { title: string; description: string; priceType: string; price: string };
  location: { city: string; neighbourhood: string; postalCode: string };
  images: string[];
  cloudinary: { cloudName: string; uploadPreset: string } | null;
}) {
  const [detailsState, detailsAction] = useFormState<FormState, FormData>(updateDetails, { ok: false });
  const [locationState, locationAction] = useFormState<FormState, FormData>(updateLocation, { ok: false });

  return (
    <>
      <form action={detailsAction} className={card}>
        <h2 className="text-sm font-semibold text-ink">Details</h2>
        <input type="hidden" name="listingId" value={listingId} />
        <DetailsFields defaults={details} fieldErrors={detailsState.fieldErrors} />
        {detailsState.error && <p role="alert" className="mt-3 text-sm text-red-600">{detailsState.error}</p>}
        {detailsState.ok && <p className="mt-3 text-sm text-green-700">Saved.</p>}
        <SubmitButton>Save details</SubmitButton>
      </form>

      <form action={locationAction} className={card}>
        <h2 className="text-sm font-semibold text-ink">Location</h2>
        <input type="hidden" name="listingId" value={listingId} />
        <LocationFields defaults={location} fieldErrors={locationState.fieldErrors} />
        {locationState.error && <p role="alert" className="mt-3 text-sm text-red-600">{locationState.error}</p>}
        {locationState.ok && <p className="mt-3 text-sm text-green-700">Saved.</p>}
        <SubmitButton>Save location</SubmitButton>
      </form>

      <div className={card}>
        <h2 className="text-sm font-semibold text-ink">Photos</h2>
        <PhotoUploader
          cloudName={cloudinary?.cloudName}
          uploadPreset={cloudinary?.uploadPreset}
          initial={images}
          action={updatePhotos}
          listingId={listingId}
          submitLabel="Save photos"
        />
      </div>

      <div className={`${card} flex flex-wrap items-center gap-2`}>
        {status === "active" && (
          <form action={markSoldAction}>
            <input type="hidden" name="listingId" value={listingId} />
            <button type="submit" className={actionButton}>Mark as sold</button>
          </form>
        )}
        {(status === "sold" || status === "expired") && (
          <form action={relistAction}>
            <input type="hidden" name="listingId" value={listingId} />
            <button type="submit" className={actionButton}>Relist</button>
          </form>
        )}
        <DeleteButton listingId={listingId} action={deleteAction} />
        <Link href="/dashboard" className="ml-auto text-sm text-ink-muted underline hover:text-brand">
          Back to dashboard
        </Link>
      </div>
    </>
  );
}
