"use server";

import { nearbyDeals, type NearbyDeal } from "@/lib/deals";
import { isPlausibleGtaPoint } from "@/lib/near";

export interface NearDealsState {
  rows?: NearbyDeal[];
  total?: number;
  error?: string;
}

/**
 * Deals near a point, called from the client with the visitor's coordinates.
 *
 * A server action rather than ?lat=&lng= on the page, for the same reason as
 * the business version: someone's precise location in a URL is written into
 * their browser history, sent out in Referer headers, and recorded in access
 * logs. Here it exists only in the request body.
 */
export async function searchDealsNearbyAction(input: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  q?: string;
}): Promise<NearDealsState> {
  // Re-validated server-side; the client is never the gate.
  if (!isPlausibleGtaPoint(input.latitude, input.longitude)) {
    return {
      error:
        "That location is outside the Greater Toronto Area, so there is nothing nearby to show.",
    };
  }

  try {
    const { rows, total } = await nearbyDeals({
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      // Trimmed and capped before it reaches a tsquery and three ILIKEs.
      q: input.q?.trim().slice(0, 80) || undefined,
    });
    return { rows, total };
  } catch {
    // Never echo the coordinates into an error that could be logged or shown.
    return { error: "Could not search right now. Please try again." };
  }
}
