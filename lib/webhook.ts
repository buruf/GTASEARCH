// Applies a completed Stripe checkout to a listing. HTTP-free: the route
// verifies the signature and maps the Stripe event to BoostCheckoutEvent;
// everything decision-shaped lives here where integration tests reach it.

import { db } from "@/lib/db";
import { isBoostTierKey, BOOST_TIERS } from "@/lib/boost";

export interface BoostCheckoutEvent {
  sessionId: string;
  amountCents: number;
  metadata: { listingId?: string; userId?: string; level?: string; days?: string };
}

export async function applyBoostCheckout(
  evt: BoostCheckoutEvent,
): Promise<"applied" | "duplicate" | "invalid" | "listing-missing"> {
  const { listingId, userId, level, days } = evt.metadata;
  const daysNum = Number(days);
  const tierKey = level ?? "";
  if (!listingId || !userId || !isBoostTierKey(tierKey) || !Number.isInteger(daysNum) || daysNum <= 0) {
    return "invalid";
  }
  // Defense in depth: the duration must match the tier we sell, not whatever
  // arrived in metadata.
  if (BOOST_TIERS[tierKey].days !== daysNum) return "invalid";

  // The payment record and the listing update must commit or fail together:
  // if the process died between two separate writes, a Stripe retry would
  // hit the payment's unique constraint (P2002) and return "duplicate"
  // without ever retrying the listing update — boost paid for, never
  // applied, permanently. Wrapping both in one transaction means a partial
  // failure rolls back the payment row too, so the retry re-applies
  // everything from scratch.
  try {
    const count = await db.$transaction(async (tx) => {
      await tx.boostPayment.create({
        data: {
          listingId,
          userId,
          stripeId: evt.sessionId,
          amount: evt.amountCents / 100,
          boostLevel: tierKey,
          duration: daysNum,
          status: "paid",
        },
      });

      const updated = await tx.listing.updateMany({
        where: { id: listingId },
        data: {
          boostLevel: tierKey,
          boostExpiresAt: new Date(Date.now() + daysNum * 86_400_000),
        },
      });
      return updated.count;
    });
    return count === 0 ? "listing-missing" : "applied";
  } catch (e) {
    const code = (e as { code?: string }).code;
    // P2002 on stripeId: webhook replay — already fully processed. Ack.
    if (code === "P2002") return "duplicate";
    // P2003: listing or user FK gone (deleted mid-payment). The create
    // failed inside the transaction, so it rolled back automatically. Keep
    // the money trail without relations.
    if (code === "P2003") {
      await db.boostPayment.createMany({
        data: [{ listingId, userId, stripeId: evt.sessionId, amount: evt.amountCents / 100, boostLevel: tierKey, duration: daysNum, status: "paid" }],
        skipDuplicates: true,
      }).catch(() => {});
      return "listing-missing";
    }
    throw e;
  }
}
