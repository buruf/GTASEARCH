"use client";

import { removeListingAction, restoreListingAction } from "@/app/admin/actions";

export function RowActions({ listingId, status }: { listingId: string; status: string }) {
  const btn = "rounded-btn px-3 py-1.5 text-xs font-semibold";
  if (status === "deleted") {
    return (
      <form action={restoreListingAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <button type="submit" className={`${btn} border border-line text-ink hover:border-brand hover:text-brand`}>
          Restore
        </button>
      </form>
    );
  }
  return (
    <form
      action={removeListingAction}
      onSubmit={(e) => { if (!confirm("Remove this listing from the site?")) e.preventDefault(); }}
    >
      <input type="hidden" name="listingId" value={listingId} />
      <button type="submit" className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
        Remove
      </button>
    </form>
  );
}
