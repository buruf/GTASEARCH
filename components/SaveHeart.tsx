"use client";

import { useOptimistic } from "react";
import { toggleSavedAction } from "@/app/saved/actions";

export function SaveHeart({
  listingId, saved, returnTo, variant = "card",
}: { listingId: string; saved: boolean; returnTo: string; variant?: "card" | "full" }) {
  const [optimistic, flip] = useOptimistic(saved, (s) => !s);

  const heart = (
    <svg viewBox="0 0 24 24" className={variant === "card" ? "h-5 w-5" : "h-5 w-5"}
      fill={optimistic ? "#2E7D32" : "none"} stroke={optimistic ? "#2E7D32" : "currentColor"}
      strokeWidth="2" aria-hidden="true">
      <path d="M12 21C7 16.5 3 13.2 3 9.3 3 6.9 4.9 5 7.3 5c1.6 0 3.1.8 4 2.1L12 8l.7-.9c.9-1.3 2.4-2.1 4-2.1C19.1 5 21 6.9 21 9.3c0 3.9-4 7.2-9 11.7z" />
    </svg>
  );

  return (
    <form action={async (fd) => { flip(saved); await toggleSavedAction(fd); }}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {variant === "card" ? (
        <button type="submit" aria-label={optimistic ? "Remove from favourites" : "Save to favourites"}
          className="rounded-full bg-white/90 p-1.5 text-ink-muted shadow-sm hover:text-brand">
          {heart}
        </button>
      ) : (
        <button type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-btn border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
          {heart}
          {optimistic ? "Saved" : "Save to favourites"}
        </button>
      )}
    </form>
  );
}
