import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { applyBoostCheckout } from "@/lib/webhook";

const STAMP = Date.now();
const EMAIL = `vitest-webhook-${STAMP}@example.com`;
let userId: string, listingId: string;

const evt = (sessionId: string, over: Partial<{ listingId: string; level: string; days: string }> = {}) => ({
  sessionId,
  amountCents: 999,
  metadata: { listingId: over.listingId ?? listingId, userId, level: over.level ?? "featured", days: over.days ?? "14" },
});

beforeAll(async () => {
  userId = (await db.user.create({ data: { email: EMAIL, name: "Webhook Test" } })).id;
  listingId = (await db.listing.create({ data: {
    title: "Webhook fixture", description: "A listing that receives test boosts from constructed events.",
    category: "electronics", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId,
  } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } }); // cascades listing + payments
  await db.$disconnect();
});

describe("applyBoostCheckout", () => {
  it("applies a boost and records the payment", async () => {
    const r = await applyBoostCheckout(evt(`cs_test_${STAMP}_a`));
    expect(r).toBe("applied");
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.boostLevel).toBe("featured");
    const days = (row!.boostExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);
    const pay = await db.boostPayment.findUnique({ where: { stripeId: `cs_test_${STAMP}_a` } });
    expect(pay!.status).toBe("paid");
    expect(Number(pay!.amount)).toBeCloseTo(9.99);
  });

  it("is replay-safe: the same session twice yields one payment, no double-apply", async () => {
    const before = await db.listing.findUnique({ where: { id: listingId } });
    const r = await applyBoostCheckout(evt(`cs_test_${STAMP}_a`));
    expect(r).toBe("duplicate");
    expect(await db.boostPayment.count({ where: { stripeId: `cs_test_${STAMP}_a` } })).toBe(1);
    const after = await db.listing.findUnique({ where: { id: listingId } });
    expect(after!.boostExpiresAt!.getTime()).toBe(before!.boostExpiresAt!.getTime());
  });

  it("rejects malformed metadata without writing anything", async () => {
    expect(await applyBoostCheckout(evt(`cs_test_${STAMP}_b`, { level: "gold" }))).toBe("invalid");
    expect(await applyBoostCheckout(evt(`cs_test_${STAMP}_c`, { days: "banana" }))).toBe("invalid");
    expect(await db.boostPayment.count({ where: { stripeId: { in: [`cs_test_${STAMP}_b`, `cs_test_${STAMP}_c`] } } })).toBe(0);
  });

  it("records the payment but skips the listing when it vanished mid-payment", async () => {
    const r = await applyBoostCheckout(evt(`cs_test_${STAMP}_d`, { listingId: "cnonexistent000000000000" }));
    expect(r).toBe("listing-missing");
    // FK constraints make a true orphan row impossible; Stripe's dashboard is
    // the money trail for this edge.
    const pay = await db.boostPayment.findUnique({ where: { stripeId: `cs_test_${STAMP}_d` } });
    expect(pay).toBeNull();
  });
});
