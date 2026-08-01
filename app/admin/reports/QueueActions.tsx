"use client";

import { dismissReportsAction, removeListingAction } from "@/app/admin/actions";

export function QueueActions({ listingId, listingStatus }: { listingId: string; listingStatus: string }) {
  const btn = "rounded-btn px-3 py-1.5 text-sm font-semibold";
  return (
    <div className="flex gap-2">
      <form action={dismissReportsAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <button type="submit" className={`${btn} border border-line text-ink hover:border-brand hover:text-brand`}>
          Dismiss all
        </button>
      </form>
      <form
        action={removeListingAction}
        onSubmit={(e) => { if (!confirm("Remove this listing from the site?")) e.preventDefault(); }}
      >
        <input type="hidden" name="listingId" value={listingId} />
        <button type="submit" className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
          {listingStatus === "deleted" ? "Action reports" : "Remove listing"}
        </button>
      </form>
    </div>
  );
}
