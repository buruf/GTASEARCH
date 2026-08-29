"use server";

import { nearbyBusinesses, isPlausibleGtaPoint, type NearbyBusiness } from "@/lib/near";
import { getBusinessCategory } from "@/lib/business-categories";

export interface NearState {
  rows?: NearbyBusiness[];
  total?: number;
  error?: string;
}

/**
 * Distance search, called from the client with the visitor's coordinates.
 *
 * Deliberately a server action rather than a page with ?lat=&lng= query
 * params. Someone's precise location is sensitive: in a URL it would be
 * written into their browser history, sent to every third party in a Referer
 * header, and recorded in server access logs. Here it lives only in the
 * request body for the life of the request.
 *
 * The trade is that these results are not linkable or bookmarkable, which for
 * a query that means "where I am standing right now" is not much of a loss.
 */
export async function searchNearbyAction(input: {
  latitude: number;
  longitude: number;
  radiusKm: number;
  category?: string;
  /** Free-text business name, e.g. "shoppers drug mart". */
  q?: string;
  page?: number;
}): Promise<NearState> {
  const { latitude, longitude } = input;

  // Re-validated here, never trusted from the client — this is the boundary.
  if (!isPlausibleGtaPoint(latitude, longitude)) {
    return {
      error:
        "That location is outside the Greater Toronto Area, so there is nothing nearby to show.",
    };
  }

  const category =
    input.category && getBusinessCategory(input.category) ? input.category : undefined;

  try {
    const { rows, total } = await nearbyBusinesses({
      latitude,
      longitude,
      radiusKm: input.radiusKm,
      category,
      // Trimmed and length-capped here rather than trusted: this string
      // reaches a tsquery and a trigram comparison.
      q: input.q?.trim().slice(0, 80) || undefined,
      page: input.page,
    });
    return { rows, total };
  } catch {
    // The coordinates must not appear in an error message that could be
    // logged or shown.
    return { error: "Could not search right now. Please try again." };
  }
}
