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
  nearbyDeals,
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

describe("deals near me", () => {
  // Open water south of Toronto: inside the GTA bounding box but far from any
  // real business, so only these fixtures can match.
  const CENTRE = { latitude: 43.44, longitude: -79.44 };

  let closeId = "";
  let farId = "";

  beforeAll(async () => {
    const base = {
      description: "Test fixture.",
      category: "restaurants",
      city: "toronto",
      address: "1 Vitest Way",
      source: "curated",
      status: "active",
    };
    // ~0.3km away.
    const close = await db.business.create({
      data: {
        ...base,
        slug: `${PREFIX}near-close`,
        name: "Vitest Close Cafe",
        latitude: 43.4425,
        longitude: -79.4425,
      },
    });
    // ~8km away — outside a 5km radius, inside 25km.
    const far = await db.business.create({
      data: {
        ...base,
        slug: `${PREFIX}near-far`,
        name: "Vitest Far Cafe",
        latitude: 43.512,
        longitude: -79.44,
      },
    });
    // A business with a deal but NO coordinates: must never appear here, and
    // must still appear on the unfiltered /deals list.
    const nowhere = await db.business.create({
      data: { ...base, slug: `${PREFIX}near-nocoords`, name: "Vitest Nowhere Cafe" },
    });

    closeId = close.id;
    farId = far.id;

    for (const [bid, title] of [
      [close.id, "Free coffee nearby"],
      [far.id, "Free coffee far away"],
      [nowhere.id, "Free coffee unplaced"],
    ] as const) {
      await db.deal.create({
        data: {
          businessId: bid,
          title,
          description: "Fixture deal.",
          startsAt: inDays(-1),
          endsAt: inDays(7),
        },
      });
    }
  });

  it("returns the closest deal first, with a distance", async () => {
    const { rows } = await nearbyDeals({ ...CENTRE, radiusKm: 25 });
    const titles = rows.map((r) => r.title);
    expect(titles.indexOf("Free coffee nearby")).toBeLessThan(
      titles.indexOf("Free coffee far away"),
    );
    const close = rows.find((r) => r.title === "Free coffee nearby");
    expect(close?.distanceKm).toBeLessThan(1);
  });

  it("excludes deals beyond the radius", async () => {
    const { rows } = await nearbyDeals({ ...CENTRE, radiusKm: 5 });
    const titles = rows.map((r) => r.title);
    expect(titles).toContain("Free coffee nearby");
    expect(titles).not.toContain("Free coffee far away");
  });

  // A missing pin must never become a guessed one.
  it("omits deals whose business has no coordinates", async () => {
    const { rows } = await nearbyDeals({ ...CENTRE, radiusKm: 25 });
    expect(rows.map((r) => r.title)).not.toContain("Free coffee unplaced");
    // But it is still on the ordinary list.
    const all = await liveDeals({ city: "toronto" });
    expect(all.rows.map((d) => d.title)).toContain("Free coffee unplaced");
  });

  it("filters by keyword against the deal and the business", async () => {
    const byDeal = await nearbyDeals({ ...CENTRE, radiusKm: 25, q: "coffee" });
    expect(byDeal.rows.length).toBeGreaterThanOrEqual(2);
    const byBusiness = await nearbyDeals({ ...CENTRE, radiusKm: 25, q: "Vitest Close" });
    expect(byBusiness.rows.map((r) => r.title)).toContain("Free coffee nearby");
  });

  it("never returns an expired deal", async () => {
    await db.deal.create({
      data: {
        businessId: closeId,
        title: "Expired nearby offer",
        description: "Gone.",
        startsAt: inDays(-10),
        endsAt: inDays(-1),
      },
    });
    const { rows } = await nearbyDeals({ ...CENTRE, radiusKm: 25 });
    expect(rows.map((r) => r.title)).not.toContain("Expired nearby offer");
  });

  it("returns nothing for a point outside the GTA", async () => {
    const { rows, total } = await nearbyDeals({ latitude: 51.5074, longitude: -0.1278, radiusKm: 25 });
    expect(rows).toHaveLength(0);
    expect(total).toBe(0);
  });
});
