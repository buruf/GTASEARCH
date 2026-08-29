// Integration tests for deals, against the real database.
//
// Self-provisioning: beforeAll creates a user and two businesses under a
// `vitest-deal-${STAMP}-` prefix, afterAll deletes exactly those. Deals cascade
// with their business, so removing the businesses removes the deals.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createDeal,
  endDeal,
  dealsForBusiness,
  dealsForOwner,
  liveDeals,
  dealTimeLeft,
  DealError,
} from "@/lib/deals";
import { FREE_DEAL_LIMIT, MAX_DEAL_DAYS } from "@/lib/plans";
import { db } from "@/lib/db";

const STAMP = Date.now().toString(36);
const PREFIX = `vitest-deal-${STAMP}-`;

let ownerId = "";
let strangerId = "";
let ownedId = "";
let unownedId = "";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

beforeAll(async () => {
  const owner = await db.user.create({
    data: { email: `${PREFIX}owner@example.com`, name: "Vitest Owner" },
  });
  const stranger = await db.user.create({
    data: { email: `${PREFIX}stranger@example.com`, name: "Vitest Stranger" },
  });
  ownerId = owner.id;
  strangerId = stranger.id;

  const base = {
    description: "Test fixture.",
    category: "restaurants",
    city: "toronto",
    address: "1 Vitest Way",
    source: "curated",
    status: "active",
  };
  const owned = await db.business.create({
    data: { ...base, slug: `${PREFIX}owned`, name: "Vitest Owned Cafe", claimedById: owner.id },
  });
  const unowned = await db.business.create({
    data: { ...base, slug: `${PREFIX}unowned`, name: "Vitest Unowned Cafe" },
  });
  ownedId = owned.id;
  unownedId = unowned.id;
});

afterAll(async () => {
  await db.business.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

const input = (title: string, days = 7) => ({
  title,
  description: "Valid Monday to Thursday.",
  code: "",
  endsAt: inDays(days),
});

describe("creating a deal", () => {
  it("lets an owner publish one on their own business", async () => {
    const id = await createDeal(ownerId, ownedId, input("15% off coffee"));
    expect(id).toBeTruthy();
    const live = await dealsForBusiness(ownedId);
    expect(live.map((d) => d.title)).toContain("15% off coffee");
  });

  // The whole trust model: nobody writes a deal on a business they do not own.
  it("refuses a business the caller does not own", async () => {
    await expect(createDeal(strangerId, ownedId, input("Fake offer"))).rejects.toThrow(DealError);
    await expect(createDeal(ownerId, unownedId, input("Fake offer"))).rejects.toThrow(DealError);
  });

  it("enforces the free plan's active-deal limit", async () => {
    // One is already live from the first test.
    await expect(createDeal(ownerId, ownedId, input("Second offer"))).rejects.toThrow(
      /already have a deal running/i,
    );
    const live = await dealsForBusiness(ownedId);
    expect(live.length).toBe(FREE_DEAL_LIMIT);
  });

  it("refuses an end date in the past or beyond the freshness limit", async () => {
    await expect(createDeal(ownerId, ownedId, input("Past", -1))).rejects.toThrow(/future/i);
    await expect(
      createDeal(ownerId, ownedId, input("Too far", MAX_DEAL_DAYS + 5)),
    ).rejects.toThrow(new RegExp(`${MAX_DEAL_DAYS} days`));
  });
});

describe("ending a deal", () => {
  it("frees the slot, and the deal stops being shown", async () => {
    const [existing] = await dealsForBusiness(ownedId);
    await endDeal(ownerId, existing.id);

    expect(await dealsForBusiness(ownedId)).toHaveLength(0);
    // The row survives so the owner can see what they ran.
    expect((await dealsForOwner(ownedId)).length).toBeGreaterThan(0);

    // And the slot is free again.
    const id = await createDeal(ownerId, ownedId, input("Back on"));
    expect(id).toBeTruthy();
  });

  it("refuses a deal the caller does not own", async () => {
    const [live] = await dealsForBusiness(ownedId);
    await expect(endDeal(strangerId, live.id)).rejects.toThrow(DealError);
  });
});

describe("live deal queries", () => {
  it("never returns an expired deal", async () => {
    // Write an already-finished deal directly, bypassing createDeal's guards.
    await db.deal.create({
      data: {
        businessId: ownedId,
        title: "Expired offer",
        description: "Should never appear.",
        startsAt: inDays(-10),
        endsAt: inDays(-1),
      },
    });
    const titles = (await dealsForBusiness(ownedId)).map((d) => d.title);
    expect(titles).not.toContain("Expired offer");

    const all = await liveDeals({ city: "toronto" });
    expect(all.rows.map((d) => d.title)).not.toContain("Expired offer");
  });

  it("never returns a deal that has not started", async () => {
    await db.deal.create({
      data: {
        businessId: ownedId,
        title: "Future offer",
        description: "Not yet.",
        startsAt: inDays(5),
        endsAt: inDays(10),
      },
    });
    const titles = (await dealsForBusiness(ownedId)).map((d) => d.title);
    expect(titles).not.toContain("Future offer");
  });

  it("hides deals when the business itself is hidden", async () => {
    await db.business.update({ where: { id: ownedId }, data: { status: "hidden" } });
    try {
      const all = await liveDeals({ city: "toronto" });
      expect(all.rows.map((d) => d.business.slug)).not.toContain(`${PREFIX}owned`);
    } finally {
      await db.business.update({ where: { id: ownedId }, data: { status: "active" } });
    }
  });
});

describe("dealTimeLeft", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  it("names the urgent cases and stays quiet otherwise", () => {
    expect(dealTimeLeft(new Date("2026-09-01T20:00:00Z"), now)).toBe("Ends today");
    expect(dealTimeLeft(new Date("2026-09-02T20:00:00Z"), now)).toBe("Ends tomorrow");
    expect(dealTimeLeft(new Date("2026-09-06T12:00:00Z"), now)).toBe("5 days left");
    // Far off: no badge, because "in 60 days" is not urgency.
    expect(dealTimeLeft(new Date("2026-11-01T12:00:00Z"), now)).toBe("");
    expect(dealTimeLeft(new Date("2026-08-30T12:00:00Z"), now)).toBe("Ended");
  });
});
