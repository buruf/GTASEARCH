import { db } from "@/lib/db";
import { effectiveBoostOf } from "@/lib/boost";

export async function toggleSaved(
  userId: string,
  listingId: string,
): Promise<{ saved: boolean }> {
  const key = { userId_listingId: { userId, listingId } };
  const existing = await db.savedListing.findUnique({ where: key });
  if (existing) {
    try {
      await db.savedListing.delete({ where: key });
    } catch (e) {
      // P2025: another request already deleted this row between our
      // findUnique and this delete. Already unsaved — not an error.
      if ((e as { code?: string }).code === "P2025") return { saved: false };
      throw e;
    }
    return { saved: false };
  }
  try {
    await db.savedListing.create({ data: { userId, listingId } });
  } catch (e) {
    // P2003: listing vanished between render and click. Treat as unsaved.
    if ((e as { code?: string }).code === "P2003") return { saved: false };
    throw e;
  }
  return { saved: true };
}

/** Which of these listings has the user saved? One query per page render. */
export async function savedIdsFor(userId: string, listingIds: string[]): Promise<string[]> {
  if (listingIds.length === 0) return [];
  const rows = await db.savedListing.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return rows.map((r) => r.listingId);
}

export type SavedDisplayStatus = "active" | "sold" | "expired" | "removed";

/** The /saved page: sold/expired/deleted items stay listed, honestly badged —
 *  a saved item silently vanishing reads as a bug. */
export async function savedListingsFor(userId: string) {
  const rows = await db.savedListing.findMany({
    where: { userId },
    orderBy: { savedAt: "desc" },
    select: {
      savedAt: true,
      listing: {
        select: {
          id: true, title: true, price: true, priceType: true, category: true,
          subcategory: true, city: true, neighbourhood: true, images: true,
          boostLevel: true, boostExpiresAt: true, createdAt: true, views: true,
          status: true, expiresAt: true,
        },
      },
    },
  });

  return rows.map(({ savedAt, listing }) => {
    let displayStatus: SavedDisplayStatus;
    if (listing.status === "deleted") displayStatus = "removed";
    else if (listing.status === "sold") displayStatus = "sold";
    else if (listing.status !== "active" || listing.expiresAt <= new Date()) displayStatus = "expired";
    else displayStatus = "active";
    return {
      ...listing,
      effectiveBoost: effectiveBoostOf(listing.boostLevel, listing.boostExpiresAt),
      savedAt,
      displayStatus,
    };
  });
}
