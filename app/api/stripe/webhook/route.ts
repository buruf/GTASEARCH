import { NextResponse } from "next/server";
import Stripe from "stripe";
import { applyBoostCheckout } from "@/lib/webhook";

// Stripe requires the RAW body for signature verification — no JSON parsing
// before constructEvent.
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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true }); // ack everything else
  }

  const session = event.data.object as Stripe.Checkout.Session;

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
