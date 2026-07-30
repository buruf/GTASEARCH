"use server";

import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export type PhoneState = { ok: boolean; phone?: string; error?: string };

export async function revealPhoneAction(_prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const userId = await requireUserId();
  if (!rateLimit(`phone:${userId}`, 20, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Daily reveal limit reached." };
  }
  const listing = await db.listing.findFirst({
    where: { id: String(formData.get("listingId") ?? ""), status: "active", expiresAt: { gt: new Date() } },
    select: { user: { select: { phone: true } } },
  });
  if (!listing?.user.phone) return { ok: false, error: "No phone number on this listing." };
  return { ok: true, phone: listing.user.phone };
}
