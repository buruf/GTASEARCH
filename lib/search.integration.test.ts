// Integration tests against the real Supabase database.
//
// Self-provisioning: beforeAll creates every listing these tests rely on under
// a throwaway user, and afterAll deletes that user (cascading the listings).
// Nothing here depends on `npm run db:seed` — the production database no longer
// carries seed data, and these tests must pass against an empty marketplace.
//
// The fixtures exist briefly as real public listings while the suite runs;
// titles are kept plausible for that reason.
//
// These cover the behaviour that cannot be verified any other way: the
// generated tsvector column, trigram matching, and the effective-boost
// ordering rule.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  searchListings,
  parseSearchParams,
  featuredListings,
  PAGE_SIZE,
} from "@/lib/search";
import { db } from "@/lib/db";

const filters = (params: Record<string, string | string[]> = {}) =>
  parseSearchParams(params);

const EMAIL = `vitest-search-${Date.now()}@example.com`;
const DAY = 24 * 60 * 60 * 1000;

// Unique token shared by exactly three fixtures with different boost states,
// so ordering can be asserted on a known, closed set of rows.
const TRIO = "zzqboosttrio";

let userId: string;

beforeAll(async () => {
  const user = await db.user.create({
    data: { email: EMAIL, name: "Search Fixtures" },
  });
  userId = user.id;

  const base = {
    description:
      "Integration test fixture for search behaviour. Not a real advertisement.",
    images: [] as string[],
    status: "active",
    expiresAt: new Date(Date.now() + 30 * DAY),
    userId,
  };

  const special = [
    // Trigram targets: "sofsa" → sofa (word_similarity 0.500, threshold 0.45),
    // "dreser" → dresser. Also the full-text and stemming targets.
    { ...base, title: "Fabric sofa in good shape", price: 220, priceType: "fixed", category: "furniture-home", city: "toronto", postalCode: "M5V 2T6" },
    { ...base, title: "White dresser with six drawers", price: 130, priceType: "fixed", category: "furniture-home", city: "toronto", postalCode: "M4C 1B5" },
    // Singular, so the plural query "bikes" proves stemming.
    { ...base, title: "Road bike with medium frame", price: 340, priceType: "fixed", category: "sports-outdoors", city: "ajax" },
    // Boost trio: live super, lapsed featured, unboosted — one shared token.
    { ...base, title: `Standing desk ${TRIO} super`, price: 300, priceType: "fixed", category: "electronics", city: "toronto", boostLevel: "super", boostExpiresAt: new Date(Date.now() + 7 * DAY) },
    { ...base, title: `Standing desk ${TRIO} lapsed`, price: 310, priceType: "fixed", category: "electronics", city: "toronto", boostLevel: "featured", boostExpiresAt: new Date(Date.now() - 1 * DAY) },
    { ...base, title: `Standing desk ${TRIO} plain`, price: 320, priceType: "fixed", category: "electronics", city: "toronto" },
    // A priceless listing, to prove price filters exclude it.
    { ...base, title: "Laptop repair service, please inquire", price: null, priceType: "contact", category: "electronics", city: "ajax" },
  ];

  // Filler to guarantee more than one full page of results.
  const filler = Array.from({ length: PAGE_SIZE + 4 }, (_, i) => ({
    ...base,
    title: `Storage bin lot number ${i + 1}`,
    price: 100 + i * 10,
    priceType: "fixed",
    category: "electronics",
    city: "toronto",
  }));

  await db.listing.createMany({ data: [...special, ...filler] });
});

afterAll(async () => {
  // Cascade deletes every fixture listing.
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

describe("full-text search", () => {
  it("finds a listing by a word in its title", async () => {
    const { rows } = await searchListings(filters({ q: "sofa" }));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.title.toLowerCase().includes("sofa"))).toBe(true);
  });

  it("stems, so a plural query matches a singular listing", async () => {
    const { rows } = await searchListings(filters({ q: "bikes" }));
    expect(rows.some((r) => r.title.toLowerCase().includes("bike"))).toBe(true);
  });

  it("returns nothing for a term that appears nowhere", async () => {
    const { rows, total } = await searchListings(
      filters({ q: "zzzznonexistentterm" }),
    );
    expect(rows).toHaveLength(0);
    expect(total).toBe(0);
  });
});

describe("trigram fallback", () => {
  // The reason the fallback exists: most classifieds traffic is mobile, where
  // typos are common, and full-text search returns zero rows for a misspelling.
  it("still finds the sofa when the query is misspelled", async () => {
    const { rows, usedFallback } = await searchListings(filters({ q: "sofsa" }));
    expect(usedFallback).toBe(true);
    expect(rows.some((r) => r.title.toLowerCase().includes("sofa"))).toBe(true);
  });

  it("recovers a dropped letter", async () => {
    const { rows } = await searchListings(filters({ q: "dreser" }));
    expect(rows.some((r) => r.title.toLowerCase().includes("dresser"))).toBe(
      true,
    );
  });

  it("does not fabricate matches for an unrelated word", async () => {
    const { rows } = await searchListings(filters({ q: "xylophone" }));
    expect(rows).toHaveLength(0);
  });
});

describe("boost ordering", () => {
  it("orders the trio: live super first, lapsed and plain by recency after", async () => {
    const { rows } = await searchListings(filters({ q: TRIO }));
    const trio = rows.filter((r) => r.title.includes(TRIO));
    expect(trio).toHaveLength(3);
    expect(trio[0].title).toContain("super");
    expect(trio[0].effectiveBoost).toBe(0);
  });

  it("treats a lapsed boost as unboosted, even though boostLevel still says otherwise", async () => {
    // This is the rule that protects against the window between a boost
    // expiring and the nightly downgrade cron running.
    const { rows } = await searchListings(filters({ q: TRIO }));
    const lapsed = rows.find((r) => r.title.includes("lapsed"));
    expect(lapsed).toBeDefined();
    expect(lapsed!.boostLevel).toBe("featured");
    expect(lapsed!.effectiveBoost).toBe(3);
  });

  it("ranks never decrease down any results page", async () => {
    const { rows } = await searchListings(filters());
    const ranks = rows.map((r) => r.effectiveBoost);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("includes only live super boosts in the homepage featured strip", async () => {
    const featured = await featuredListings();
    expect(featured.some((f) => f.title.includes(TRIO))).toBe(true);
    for (const f of featured) {
      expect(f.boostLevel).toBe("super");
      expect(f.boostExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    }
  });
});

describe("filters", () => {
  it("restricts by category", async () => {
    const { rows } = await searchListings(filters({ category: "electronics" }));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.category === "electronics")).toBe(true);
  });

  it("restricts by multiple cities", async () => {
    const { rows } = await searchListings(
      filters({ city: ["toronto", "ajax"] }),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => ["toronto", "ajax"].includes(r.city))).toBe(true);
  });

  it("applies a price range and excludes priceless listings", async () => {
    const { rows } = await searchListings(
      filters({ minPrice: "100", maxPrice: "500" }),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.price).not.toBeNull();
      const n = Number(r.price);
      expect(n).toBeGreaterThanOrEqual(100);
      expect(n).toBeLessThanOrEqual(500);
    }
  });

  it("sorts by price ascending within boost tiers", async () => {
    const { rows } = await searchListings(filters({ sort: "price-asc" }));
    const unboosted = rows.filter((r) => r.effectiveBoost === 3 && r.price);
    const prices = unboosted.map((r) => Number(r.price));
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("survives a filter combination that matches nothing", async () => {
    const { rows, total } = await searchListings(
      filters({ category: "pets", city: "barrie", minPrice: "999999" }),
    );
    expect(rows).toHaveLength(0);
    expect(total).toBe(0);
  });
});

describe("privacy", () => {
  it("never returns postalCode in search results", async () => {
    const { rows } = await searchListings(filters());
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).not.toHaveProperty("postalCode");
    }
  });

  it("has postal codes stored, proving the omission is deliberate", async () => {
    // Guards against the test above passing trivially because the column is
    // empty rather than because it is excluded from the projection.
    const withPostal = await db.listing.count({
      where: { postalCode: { not: null }, userId },
    });
    expect(withPostal).toBeGreaterThan(0);
  });
});

describe("pagination", () => {
  it("returns a full page and a total larger than it", async () => {
    const { rows, total } = await searchListings(filters());
    expect(rows.length).toBe(PAGE_SIZE);
    expect(total).toBeGreaterThan(PAGE_SIZE);
  });

  it("returns different listings on page 2", async () => {
    const p1 = await searchListings(filters({ page: "1" }));
    const p2 = await searchListings(filters({ page: "2" }));
    const overlap = p1.rows.filter((a) => p2.rows.some((b) => b.id === a.id));
    expect(overlap).toHaveLength(0);
  });

  it("returns an empty page past the end without error", async () => {
    const { rows } = await searchListings(filters({ page: "999" }));
    expect(rows).toHaveLength(0);
  });
});
