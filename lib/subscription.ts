// GTASearch Pro subscriptions.
//
// Same architecture as boosts (lib/stripe.ts + lib/webhook.ts): checkout only
// ever STARTS a payment, and the webhook is the ONLY writer of plan state.
// Nothing here trusts a redirect back from Stripe — a user can visit the
// success URL by hand.
//
// Keys-later: without STRIPE_SECRET_KEY every entry point is hidden and this
// module refuses, so the site works fine before the keys exist.

import Stripe from "stripe";
import { db } from "@/lib/db";
import { ownedBusiness } from "@/lib/claims";
import { PRO_CURRENCY, PRO_PRICE_CENTS } from "@/lib/plans";
import { stripeEnabled, appUrl } from "@/lib/env";

export class SubscriptionDisabledError extends Error {
  constructor() {
    super("Stripe is not configured");
  }
}

/**
 * Starts a Pro subscription checkout for a business the caller owns.
 * Ownership is checked before any network call, so hostile input never
 * reaches Stripe.
 */
export async function createProCheckout(userId: string, businessId: string): Promise<string> {
  if (!stripeEnabled()) throw new SubscriptionDisabledError();

  const business = await ownedBusiness(userId, businessId);
  if (business.plan === "pro") throw new Error("Already subscribed");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PRO_CURRENCY,
          unit_amount: PRO_PRICE_CENTS,
          recurring: { interval: "month" },
          product_data: {
            name: "GTASearch Pro",
            description: `Monthly plan for "${business.name}"`,
          },
        },
      },
    ],
    // Server-bound: the webhook reads these rather than anything the client
    // could tamper with. subscription_data.metadata matters because later
    // lifecycle events (renewal, cancellation) carry the subscription, not
    // the checkout session.
    metadata: { businessId, userId },
    subscription_data: { metadata: { businessId, userId } },
    ...(business.stripeCustomerId ? { customer: business.stripeCustomerId } : {}),
    success_url: `${appUrl()}/dashboard/business/${businessId}?upgraded=1`,
    cancel_url: `${appUrl()}/dashboard/business/${businessId}/upgrade?cancelled=1`,
  });

  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/**
 * A billing-portal link so a subscriber can cancel or change their card
 * without emailing us. Stripe hosts it; we never see card details.
 */
export async function createBillingPortalUrl(userId: string, businessId: string): Promise<string> {
  if (!stripeEnabled()) throw new SubscriptionDisabledError();
  const business = await ownedBusiness(userId, businessId);
  if (!business.stripeCustomerId) throw new Error("No billing account yet");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const portal = await stripe.billingPortal.sessions.create({
    customer: business.stripeCustomerId,
    return_url: `${appUrl()}/dashboard/business/${businessId}`,
  });
  return portal.url;
}

/**
 * Applies a completed subscription checkout. Called only by the webhook.
 *
 * Idempotent by design: updateMany on the business, keyed by id, writing the
 * same values however many times Stripe redelivers the event.
 */
export async function applyProCheckout(params: {
  businessId: string;
  customerId: string;
  subscriptionId: string;
  currentPeriodEnd: Date;
}): Promise<void> {
  await db.business.updateMany({
    where: { id: params.businessId },
    data: {
      plan: "pro",
      stripeCustomerId: params.customerId,
      stripeSubscriptionId: params.subscriptionId,
      planRenewsAt: params.currentPeriodEnd,
    },
  });
}

/**
 * Reflects a subscription lifecycle change. Stripe is the source of truth:
 * "active"/"trialing" keep Pro and push the renewal date forward; anything
 * else (cancelled, unpaid, incomplete) drops the business back to free.
 *
 * Keyed on the subscription id rather than the business id so a stale or
 * out-of-order event can never downgrade a business that has since started a
 * NEW subscription.
 */
export async function syncSubscriptionState(params: {
  subscriptionId: string;
  status: string;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  const active = params.status === "active" || params.status === "trialing";
  await db.business.updateMany({
    where: { stripeSubscriptionId: params.subscriptionId },
    data: active
      ? { plan: "pro", planRenewsAt: params.currentPeriodEnd }
      : { plan: "free", planRenewsAt: null },
  });
}
