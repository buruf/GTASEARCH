import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createBoostCheckout, StripeDisabledError } from "@/lib/stripe";
import { NotOwnerError } from "@/lib/manage";

const STAMP = Date.now();
const EMAILS = [`vitest-stripe-own-${STAMP}@example.com`, `vitest-stripe-other-${STAMP}@example.com`];
let ownerId: string, otherId: string, listingId: string;

const ORIGINAL_STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

beforeAll(async () => {
  ownerId = (await db.user.create({ data: { email: EMAILS[0], name: "Owner" } })).id;
  otherId = (await db.user.create({ data: { email: EMAILS[1], name: "Other" } })).id;
  listingId = (await db.listing.create({ data: {
    title: "Boostable fixture", description: "A listing that exists so checkout guards can be tested.",
    category: "electronics", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: ownerId,
  } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  await db.$disconnect();
  if (ORIGINAL_STRIPE_SECRET_KEY === undefined) {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = ORIGINAL_STRIPE_SECRET_KEY;
  }
});
beforeEach(() => { delete process.env.STRIPE_SECRET_KEY; });

describe("createBoostCheckout guards (degraded: no Stripe key)", () => {
  it("throws StripeDisabledError without a key — and checks that FIRST", async () => {
    await expect(createBoostCheckout(ownerId, listingId, "top")).rejects.toThrow(StripeDisabledError);
  });
  it("with a fake key set, non-owners are rejected before any Stripe call", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_never_called";
    await expect(createBoostCheckout(otherId, listingId, "top")).rejects.toThrow(NotOwnerError);
  });
  it("with a fake key set, a sold listing is not boostable", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_never_called";
    await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
    await expect(createBoostCheckout(ownerId, listingId, "super")).rejects.toThrow(/not boostable/i);
    await db.listing.update({ where: { id: listingId }, data: { status: "active" } });
  });
});
