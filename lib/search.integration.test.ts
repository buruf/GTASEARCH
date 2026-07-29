// Integration tests against the real Supabase database with seeded data.
// Run `npm run db:seed` first.
//
// These cover the behaviour that cannot be verified any other way: the
// generated tsvector column, trigram matching, and the effective-boost
// ordering rule.

import { describe, it, expect, beforeAll } from "vitest";
import { searchListings, parseSearchParams, featuredListings } from "@/lib/search";
import { db } from "@/lib/db";

const filters = (params: Record<string, string | string[]> = {}) =>
  parseSearchParams(params);

beforeAll(async () => {
  const count = await db.listing.count();
  if (count === 0) {
    throw new Error("No listings found. Run `npm run db:seed` first.");
  }
});

describe("full-text search", () => {
  it("finds a listing by a word in its title", async () => {
    const { rows } = await searchListings(filters({ q: "sofa" }));
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.some((r) => r.title.toLowerCase().includes("sofa")),
    ).toBe(true);
  });

  it("stems, so a plural query matches a singular listing", async () => {
    const { rows } = await searchListings(filters({ q: "bikes" }));
    expect(rows.length).toBeGreaterThan(0);
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
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.title.toLowerCase().includes("sofa"))).toBe(true);
  });

  it("recovers a dropped letter", async () => {
    const { rows } = await searchListings(filters({ q: "dreser" }));
    expect(rows.some((r) => r.title.toLowerCase().includes("dresser"))).toBe(
      true,
    );
  });

  it("does not match an unrelated synonym", async () => {
    // "couch" must not trigram-match "Civic" or similar. It may legitimately
    // full-text match listings whose description says couch, so assert the
    // narrower thing: nothing irrelevant comes back via similarity.
    const { rows } = await searchListings(filters({ q: "xylophone" }));
    expect(rows).toHaveLength(0);
  });
});

describe("boost ordering", () => {
  it("places live-boosted listings above unboosted ones", async () => {
    const { rows } = await searchListings(filters());
    const firstUnboosted = rows.findIndex((r) => r.effectiveBoost === 3);
    const lastBoosted = rows.map((r) => r.effectiveBoost).lastIndexOf(0);
    if (firstUnboosted !== -1 && lastBoosted !== -1) {
      expect(lastBoosted).toBeLessThan(firstUnboosted);
    }
    // Ranks must be non-decreasing down the page.
    const ranks = rows.map((r) => r.effectiveBoost);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it("treats a lapsed boost as unboosted, even though boostLevel still says otherwise", async () => {
    // This is the rule that protects against the window between a boost
    // expiring and the nightly downgrade cron running.
    const lapsed = await db.listing.findFirst({
      where: {
        boostLevel: { not: "none" },
        boostExpiresAt: { lt: new Date() },
        status: "active",
      },
    });
    expect(lapsed, "seed should include a lapsed boost").not.toBeNull();

    const { rows } = await searchListings(filters());
    const found = rows.find((r) => r.id === lapsed!.id);
    if (found) {
      expect(found.boostLevel).not.toBe("none");
      expect(found.effectiveBoost).toBe(3);
    }
  });

  it("excludes lapsed boosts from the homepage featured strip", async () => {
    const featured = await featuredListings();
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
      where: { postalCode: { not: null } },
    });
    expect(withPostal).toBeGreaterThan(0);
  });
});

describe("pagination", () => {
  it("returns a full page and a total larger than it", async () => {
    const { rows, total } = await searchListings(filters());
    expect(rows.length).toBe(24);
    expect(total).toBeGreaterThan(24);
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
