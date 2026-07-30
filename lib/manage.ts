import { db } from "@/lib/db";
import { getDraft } from "@/lib/draft";
import { firstIncompleteStep } from "@/lib/draft";
import { violatesModeration } from "@/lib/moderation";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function publishDraft(
  userId: string,
): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const draft = await getDraft(userId);
  if (!draft) return { ok: false, error: "No draft to publish." };

  if (firstIncompleteStep(draft) !== "review") {
    return { ok: false, error: "Your ad is missing required information." };
  }

  // Generic rejection — never reveal which word tripped (spec §4).
  if (violatesModeration(`${draft.title}\n${draft.description}`)) {
    return { ok: false, error: "This listing can't be published as written. Please revise the title or description." };
  }

  const updated = await db.listing.update({
    where: { id: draft.id },
    data: { status: "active", expiresAt: new Date(Date.now() + THIRTY_DAYS) },
  });
  return { ok: true, listingId: updated.id };
}

export class NotOwnerError extends Error {
  constructor() { super("Not the owner of this listing"); }
}

/** Loads the listing and enforces ownership — the IDOR guard every dashboard
 *  mutation goes through. Client-supplied IDs are never trusted alone. */
export async function ownedListing(userId: string, listingId: string) {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status === "deleted") throw new NotOwnerError();
  if (listing.userId !== userId) throw new NotOwnerError();
  return listing;
}

export async function markSold(userId: string, listingId: string): Promise<void> {
  await ownedListing(userId, listingId);
  await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
}

export async function softDeleteListing(userId: string, listingId: string): Promise<void> {
  await ownedListing(userId, listingId);
  await db.listing.update({ where: { id: listingId }, data: { status: "deleted" } });
}

export async function relistListing(userId: string, listingId: string): Promise<void> {
  await ownedListing(userId, listingId);
  // createdAt untouched: relisting is not a free bump to the top (spec §5).
  await db.listing.update({
    where: { id: listingId },
    data: { status: "active", expiresAt: new Date(Date.now() + THIRTY_DAYS) },
  });
}
