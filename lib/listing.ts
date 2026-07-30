import { db } from "@/lib/db";

/**
 * Loads one listing for the public detail page.
 *
 * The select is explicit and deliberately omits postalCode — it is collected
 * only for future distance sorting and must never reach the client. Returns
 * null for anything not publicly visible (missing, sold, deleted or expired)
 * so the page can render a 404 rather than leaking that it exists.
 */
export async function getPublicListing(id: string) {
  const listing = await db.listing.findFirst({
    where: { id, status: "active", expiresAt: { gt: new Date() } },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      priceType: true,
      category: true,
      subcategory: true,
      city: true,
      neighbourhood: true,
      images: true,
      boostLevel: true,
      boostExpiresAt: true,
      views: true,
      createdAt: true,
      // postalCode intentionally absent — see above.
      user: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          phone: true,
        },
      },
    },
  });

  if (!listing) return null;

  const activeAds = await db.listing.count({
    where: {
      userId: listing.user.id,
      status: "active",
      expiresAt: { gt: new Date() },
    },
  });

  const boostLive =
    listing.boostExpiresAt !== null && listing.boostExpiresAt > new Date();

  return {
    ...listing,
    user: { id: listing.user.id, name: listing.user.name, createdAt: listing.user.createdAt },
    hasPhone: Boolean(listing.user.phone),
    activeAds,
    /** True only when the boost has not lapsed — never trust boostLevel alone. */
    isFeatured: boostLive && ["super", "featured"].includes(listing.boostLevel),
  };
}

/** Ids of every publicly visible listing, for the sitemap. */
export async function allVisibleListingIds() {
  return db.listing.findMany({
    where: { status: "active", expiresAt: { gt: new Date() } },
    select: { id: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
}
