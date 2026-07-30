"use client";

/**
 * Delete is destructive and permanent (soft-delete server-side, but the ad is
 * gone from the user's perspective), so it gets a confirm() gate — the only
 * dashboard action that does. Kept as its own tiny client component because
 * the confirm/preventDefault logic needs an onSubmit handler, which a server
 * component can't attach; the server action itself is passed in as a prop.
 */
export function DeleteButton({
  listingId,
  action,
}: {
  listingId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this ad permanently? It will disappear from the site.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="listingId" value={listingId} />
      <button
        type="submit"
        className="rounded-btn border border-line px-3 py-1.5 text-xs font-semibold text-red-600 hover:border-red-600"
      >
        Delete
      </button>
    </form>
  );
}
