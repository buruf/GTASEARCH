"use server";

import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { ClaimError } from "@/lib/claims";
import { SubscriptionDisabledError, createProCheckout } from "@/lib/subscription";

/**
 * Starts Stripe checkout and sends the owner there.
 *
 * Nothing about the plan changes here — the webhook is the only writer of
 * plan state, so abandoning this checkout leaves the business exactly as it
 * was.
 */
export async function startProCheckout(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  const businessId = String(formData.get("businessId") ?? "");
  if (!userId) redirect("/auth/signin?callbackUrl=%2Fdashboard%2Fbusiness");
  if (!businessId) redirect("/dashboard/business");

  let url: string;
  try {
    url = await createProCheckout(userId, businessId);
  } catch (err) {
    if (err instanceof SubscriptionDisabledError || err instanceof ClaimError) {
      redirect(`/dashboard/business/${businessId}/upgrade?cancelled=1`);
    }
    throw err;
  }
  // redirect() throws, so it must sit outside the try — otherwise the catch
  // above would swallow Next's control-flow error.
  redirect(url);
}
