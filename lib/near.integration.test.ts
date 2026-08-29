// Integration tests for "near me" keyword matching, against the real database.
//
// Self-provisioning, following lib/business.integration.test.ts: beforeAll
// creates fixtures under a `vitest-near-${STAMP}-` slug prefix and afterAll
// deletes exactly those rows. Coordinates are placed in a deliberately empty
// stretch of Lake Ontario so the radius search returns the fixtures and
// nothing else — the real directory has 53,850 located businesses and any
// on-land test point would drown the assertions in real data.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { nearbyBusinesses } from "@/lib/near";
import { db } from "@/lib/db";

const STAMP = Date.now().toString(36);
const PREFIX = `vitest-near-${STAMP}-`;

// Open water south of Toronto: inside the GTA bounding box the schema allows,
// far from any real business.
const CENTRE = { latitude: 43.45, longitude: -79.45 };

const FIXTURES = [
  {
    slug: `${PREFIX}halal-grocer`,
    name: "Vitest Halal Meat & Supermarket",
    category: "restaurants",
    subcategory: "grocery",
    // The description a real grocer gets — note it contains no "food", which
    // is exactly why "halal food" used to miss businesses like this.
    description: "Grocery in Brampton. Listed in the City of Brampton Business Directory.",
    lat: 43.4505,
    lng: -79.4505,
  },
  {
    slug: `${PREFIX}korean`,
    name: "Vitest Tigers Korean Food",
    category: "restaurants",
    subcategory: null,
    description: "Restaurants & Food in Toronto. Licensed with the City of Toronto.",
    lat: 43.4502,
    lng: -79.4502,
  },
  {
    slug: `${PREFIX}pharmacy`,
    name: "Vitest Shoppers Drug Mart",
    category: "health",
    subcategory: "pharmacies",
    description: "Pharmacies in Toronto. Licensed with the City of Toronto.",
    lat: 43.4508,
    lng: -79.4508,
  },
];

beforeAll(async () => {
  for (const f of FIXTURES) {
    await db.business.create({
      data: {
        slug: f.slug,
        name: f.name,
        description: f.description,
        category: f.category,
        subcategory: f.subcategory,
        city: "toronto",
        address: "1 Vitest Way",
        source: "curated",
        status: "active",
        latitude: f.lat,
        longitude: f.lng,
      },
    });
  }
});

afterAll(async () => {
  await db.business.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("near-me keyword matching", () => {
  it("finds a halal grocer for 'halal food', even though its description says Grocery", async () => {
    const { rows } = await nearbyBusinesses({ ...CENTRE, radiusKm: 2, q: "halal food" });
    expect(names(rows)).toContain("Vitest Halal Meat & Supermarket");
  });

  // The bug this guards: "food" alone used to match, putting a Korean
  // restaurant at the top of a halal search.
  it("does not return a Korean restaurant for 'halal food'", async () => {
    const { rows } = await nearbyBusinesses({ ...CENTRE, radiusKm: 2, q: "halal food" });
    expect(names(rows)).not.toContain("Vitest Tigers Korean Food");
  });

  it("matches a business by name", async () => {
    const { rows } = await nearbyBusinesses({ ...CENTRE, radiusKm: 2, q: "shoppers drug mart" });
    expect(names(rows)).toContain("Vitest Shoppers Drug Mart");
  });

  it("tolerates a typo on a single word", async () => {
    const { rows } = await nearbyBusinesses({ ...CENTRE, radiusKm: 2, q: "shopperss" });
    expect(names(rows)).toContain("Vitest Shoppers Drug Mart");
  });

  it("returns everything nearby when no keyword is given", async () => {
    const { rows } = await nearbyBusinesses({ ...CENTRE, radiusKm: 2 });
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("orders by distance, closest first", async () => {
    const { rows } = await nearbyBusinesses({ ...CENTRE, radiusKm: 2 });
    const distances = rows.map((r) => r.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("excludes anything beyond the radius", async () => {
    // 100m radius around a point ~5km away from the fixtures.
    const { total } = await nearbyBusinesses({
      latitude: 43.5,
      longitude: -79.5,
      radiusKm: 1,
      q: "vitest",
    });
    expect(total).toBe(0);
  });
});
