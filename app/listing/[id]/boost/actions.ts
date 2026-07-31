"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { isBoostTierKey } from "@/lib/boost";
import { createBoostCheckout, StripeDisabledError } from "@/lib/stripe";
import { NotOwnerError } from "@/lib/manage";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "@/app/auth/actions";

export async function startBoostCheckoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  const tier = String(formData.get("tier") ?? "");
  if (!isBoostTierKey(tier)) return { ok: false, error: "Pick a boost tier." };
  if (!rateLimit(`boost:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Too many checkout attempts today. Try again tomorrow." };
  }

  let url: string;
  try {
    url = await createBoostCheckout(userId, listingId, tier);
  } catch (e) {
    if (e instanceof StripeDisabledError) return { ok: false, error: "Payments aren't configured yet." };
    if (e instanceof NotOwnerError) return { ok: false, error: "You can only boost your own listings." };
    if (e instanceof Error && /not boostable/i.test(e.message)) {
      return { ok: false, error: "Only active listings can be boosted." };
    }
    throw e;
  }
  redirect(url);
}
