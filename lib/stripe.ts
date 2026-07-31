// Stripe checkout for listing boosts. Keys-later: without STRIPE_SECRET_KEY
// every entry point is hidden and this module refuses. Payment confirmation
// NEVER happens here — the webhook (lib/webhook.ts) is the only writer of
// boost state.

import Stripe from "stripe";
import { db } from "@/lib/db";
import { BOOST_TIERS, type BoostTierKey } from "@/lib/boost";
import { ownedListing } from "@/lib/manage";
import { stripeEnabled, appUrl } from "@/lib/env";

export class StripeDisabledError extends Error {
  constructor() { super("Stripe is not configured"); }
}

export async function createBoostCheckout(
  userId: string,
  listingId: string,
  tier: BoostTierKey,
): Promise<string> {
  if (!stripeEnabled()) throw new StripeDisabledError();

  // Guard order matters: ownership and boostability are checked before any
  // network call so tests (and hostile input) never reach Stripe.
  const listing = await ownedListing(userId, listingId);
  if (listing.status !== "active" || listing.expiresAt <= new Date()) {
    throw new Error("Listing not boostable");
  }

  const t = BOOST_TIERS[tier];
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "cad",
        unit_amount: t.cents,
        product_data: {
          name: `${t.label} — ${t.days} days`,
          description: `Boost for "${listing.title}" on GTASearch`,
        },
      },
    }],
    metadata: { listingId, userId, level: t.level, days: String(t.days) },
    success_url: `${appUrl()}/listing/${listingId}?boost=success`,
    cancel_url: `${appUrl()}/listing/${listingId}/boost?cancelled=1`,
  });

  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}
