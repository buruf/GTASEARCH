// Integration tests for subscription state, against the real database.
//
// These cover what only the database can prove: that the webhook's writers are
// idempotent under Stripe's at-least-once redelivery, and that a stale event
// for an OLD subscription cannot downgrade a business that has since started a
// new one.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { applyProCheckout, syncSubscriptionState } from "@/lib/subscription";

const STAMP = Date.now();
const PREFIX = `vitest-sub-${STAMP}-`;
let businessId = "";

const RENEWS = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  businessId = (
    await db.business.create({
      data: {
        slug: `${PREFIX}biz`,
        name: "Subscription fixture",
        description: "Test fixture.",
        category: "health",
        city: "toronto",
        address: "1 Test St",
        images: [],
        status: "active",
        source: "open-data",
      },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  await db.business.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await db.$disconnect();
});

describe("applyProCheckout", () => {
  it("puts the business on Pro with its renewal date", async () => {
    await applyProCheckout({
      businessId,
      customerId: `${PREFIX}cus`,
      subscriptionId: `${PREFIX}sub1`,
      currentPeriodEnd: RENEWS,
    });
    const b = await db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { plan: true, stripeSubscriptionId: true, planRenewsAt: true },
    });
    expect(b.plan).toBe("pro");
    expect(b.stripeSubscriptionId).toBe(`${PREFIX}sub1`);
    expect(b.planRenewsAt?.getTime()).toBe(RENEWS.getTime());
  });

  it("is idempotent — Stripe redelivers events", async () => {
    await applyProCheckout({
      businessId,
      customerId: `${PREFIX}cus`,
      subscriptionId: `${PREFIX}sub1`,
      currentPeriodEnd: RENEWS,
    });
    const count = await db.business.count({ where: { stripeSubscriptionId: `${PREFIX}sub1` } });
    expect(count).toBe(1);
  });
});

describe("syncSubscriptionState", () => {
  it("keeps Pro alive on renewal and moves the date forward", async () => {
    const later = new Date(RENEWS.getTime() + 30 * 24 * 60 * 60 * 1000);
    await syncSubscriptionState({
      subscriptionId: `${PREFIX}sub1`,
      status: "active",
      currentPeriodEnd: later,
    });
    const b = await db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { plan: true, planRenewsAt: true },
    });
    expect(b.plan).toBe("pro");
    expect(b.planRenewsAt?.getTime()).toBe(later.getTime());
  });

  it("drops the business to free when the subscription is cancelled", async () => {
    await syncSubscriptionState({
      subscriptionId: `${PREFIX}sub1`,
      status: "canceled",
      currentPeriodEnd: null,
    });
    const b = await db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { plan: true, planRenewsAt: true },
    });
    expect(b.plan).toBe("free");
    expect(b.planRenewsAt).toBeNull();
  });

  it("ignores an event for a subscription we do not hold", async () => {
    // Keyed on subscription id, so a late event for a DIFFERENT (old)
    // subscription must not touch a business that resubscribed since.
    await applyProCheckout({
      businessId,
      customerId: `${PREFIX}cus`,
      subscriptionId: `${PREFIX}sub2`,
      currentPeriodEnd: RENEWS,
    });
    await syncSubscriptionState({
      subscriptionId: `${PREFIX}sub1`, // the old, dead one
      status: "canceled",
      currentPeriodEnd: null,
    });
    const b = await db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { plan: true, stripeSubscriptionId: true },
    });
    expect(b.stripeSubscriptionId).toBe(`${PREFIX}sub2`);
    expect(b.plan).toBe("pro"); // still paid — the stale event was ignored
  });
});
