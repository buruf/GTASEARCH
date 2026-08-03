import { NextResponse } from "next/server";
import Stripe from "stripe";
import { applyBoostCheckout } from "@/lib/webhook";
import { applyProCheckout, syncSubscriptionState } from "@/lib/subscription";

// Stripe requires the RAW body for signature verification — no JSON parsing
// before constructEvent.
//
// Two products arrive here: one-time listing boosts (mode "payment") and Pro
// subscriptions (mode "subscription"). This route is the ONLY writer of boost
// and plan state anywhere in the codebase.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = new Stripe(key).webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Subscription lifecycle: renewals, cancellations, failed payments. Stripe
  // is the source of truth for whether a plan is live, so mirror its status
  // rather than inferring one from our side.
  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object as Stripe.Subscription & { current_period_end?: number };
    await syncSubscriptionState({
      subscriptionId: sub.id,
      // A deleted subscription is never active, whatever status it carries.
      status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    });
    return NextResponse.json({ received: true, result: "subscription-synced" });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true }); // ack everything else
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.mode === "subscription") {
    const businessId = session.metadata?.businessId;
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (!businessId || !subscriptionId || !customerId) {
      return NextResponse.json({ received: true, result: "invalid" });
    }

    // The session does not carry the period end, so read it off the
    // subscription rather than guessing a month from today.
    const sub = (await new Stripe(key).subscriptions.retrieve(
      subscriptionId,
    )) as Stripe.Subscription & { current_period_end?: number };
    await applyProCheckout({
      businessId,
      customerId,
      subscriptionId,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
    });
    return NextResponse.json({ received: true, result: "pro-applied" });
  }

  // Delayed-notification payment methods (e.g. some bank debits) complete
  // the checkout session before money actually moves. Only "paid" sessions
  // should apply the boost; async_payment_succeeded handling can be added
  // if such methods are ever enabled.
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, result: "unpaid" });
  }

  const result = await applyBoostCheckout({
    sessionId: session.id,
    amountCents: session.amount_total ?? 0,
    metadata: {
      listingId: session.metadata?.listingId,
      userId: session.metadata?.userId,
      level: session.metadata?.level,
      days: session.metadata?.days,
    },
  });
  // Always 200 once verified: Stripe retries non-2xx, and every branch here
  // is terminal (applied/duplicate/invalid/listing-missing).
  return NextResponse.json({ received: true, result });
}
