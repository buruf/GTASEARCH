"use client";

import { useEffect } from "react";

/**
 * Records one view per listing per browser session.
 *
 * sessionStorage is checked before firing so a rapid refresh does not inflate
 * the count; the server also sets a cookie as a second guard. Owner-view
 * exclusion needs an authenticated session and arrives with Phase 2.
 *
 * Renders nothing. If JavaScript is off, the view simply is not counted, which
 * is harmless.
 */
export function ViewCounter({ listingId }: { listingId: string }) {
  useEffect(() => {
    const key = `viewed:${listingId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Private browsing can throw on sessionStorage; fall through and let the
      // server-side cookie guard handle deduplication.
    }

    const timer = setTimeout(() => {
      fetch(`/api/listings/${listingId}/view`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {
        // A failed view count must never surface to the user.
      });
    }, 1500); // Debounce: only count a view once the page has actually been read.

    return () => clearTimeout(timer);
  }, [listingId]);

  return null;
}
