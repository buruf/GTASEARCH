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
