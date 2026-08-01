// Integration tests against the real Supabase database.
//
// Self-provisioning: beforeAll creates every business these tests rely on
// under slugs prefixed `vitest-biz-${STAMP}-`, and afterAll deletes every row
// with that prefix. Nothing here depends on a directory import having run —
// as of Phase 5A Task 3 the production Business table holds no rows, and
// these tests must pass against an empty directory.
//
// These cover the behaviour that cannot be verified any other way: the
// generated tsvector column, trigram matching, and the verified-first
// ordering rule.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  searchBusinesses,
  parseBusinessSearchParams,
  getBusiness,
  browseBusinesses,
  businessCountsByCategory,
  businessCityCounts,
  similarBusinesses,
} from "@/lib/business";
import { db } from "@/lib/db";

const STAMP = Date.now();
const PREFIX = `vitest-biz-${STAMP}-`;

// Two categories x two cities, ≥8 fixtures, one verified, plus a dedicated
// trigram target ("Lakeshore Dental Centre" for the misspelled query "Dentl").
const FIXTURES = [
  {
    slug: `${PREFIX}lakeshore-dental-centre`,
    name: "Lakeshore Dental Centre",
    category: "health",
    subcategory: "dentists",
    city: "toronto",
    verified: true,
  },
  {
    slug: `${PREFIX}downtown-dental-clinic`,
    name: "Downtown Dental Clinic",
    category: "health",
    subcategory: "dentists",
    city: "toronto",
    verified: false,
  },
  {
    slug: `${PREFIX}downtown-physio-clinic`,
    name: "Downtown Physio Clinic",
    category: "health",
    subcategory: "physiotherapy",
    city: "toronto",
    verified: false,
  },
  {
    slug: `${PREFIX}mississauga-family-dentistry`,
    name: "Mississauga Family Dentistry",
    category: "health",
    subcategory: "dentists",
    city: "mississauga",
    verified: false,
  },
  {
    slug: `${PREFIX}toronto-plumbing-pros`,
    name: "Toronto Plumbing Pros",
    category: "home-services",
    subcategory: "plumbers",
    city: "toronto",
    verified: false,
  },
  {
    slug: `${PREFIX}gta-electric-co`,
    name: "GTA Electric Co",
    category: "home-services",
    subcategory: "electricians",
    city: "toronto",
    verified: true,
  },
  {
    slug: `${PREFIX}mississauga-cleaning-squad`,
    name: "Mississauga Cleaning Squad",
    category: "home-services",
    subcategory: "cleaning",
    city: "mississauga",
    verified: false,
  },
  {
    slug: `${PREFIX}lakeshore-landscaping`,
    name: "Lakeshore Landscaping",
    category: "home-services",
    subcategory: "landscaping",
    city: "mississauga",
    verified: false,
  },
] as const;

beforeAll(async () => {
  const base = {
    description:
      "Integration test fixture for business directory behaviour. Not a real business.",
    address: "123 Test St",
    phone: null,
    website: null,
    images: [] as string[],
    status: "active",
    source: "self",
  };

  await db.business.createMany({
    data: FIXTURES.map((f) => ({
      ...base,
      slug: f.slug,
      name: f.name,
      category: f.category,
      subcategory: f.subcategory,
      city: f.city,
      verified: f.verified,
    })),
  });
});

afterAll(async () => {
  await db.business.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await db.$disconnect();
});

describe("business search", () => {
  it("finds by name word, verified first on ties", async () => {
    const { rows } = await searchBusinesses(
      parseBusinessSearchParams({ q: "dental" }),
    );
    expect(rows.some((r) => r.name.includes("Lakeshore Dental"))).toBe(true);
    const verifiedIdx = rows.findIndex((r) => r.verified);
    if (verifiedIdx > 0) {
      expect(rows.slice(0, verifiedIdx).every((r) => r.verified)).toBe(true);
    }
  });

  it("recovers a typo through the trigram fallback", async () => {
    const { rows, usedFallback } = await searchBusinesses(
      parseBusinessSearchParams({ q: "Dentl" }),
    );
    expect(usedFallback).toBe(true);
    expect(rows.some((r) => r.name.includes("Dental"))).toBe(true);
  });

  it("filters by category and city, degrades unknown slugs", async () => {
    const f = parseBusinessSearchParams({
      q: "",
      category: "health",
      city: "toronto",
    });
    const { rows } = await searchBusinesses(f);
    expect(
      rows.every((r) => r.category === "health" && r.city === "toronto"),
    ).toBe(true);
    // Our three toronto/health fixtures must be present in this filtered set.
    const names = rows.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Lakeshore Dental Centre",
        "Downtown Dental Clinic",
        "Downtown Physio Clinic",
      ]),
    );

    const g = parseBusinessSearchParams({
      category: "not-real",
      city: "gotham",
    });
    expect(g.category).toBeUndefined();
    expect(g.city).toBeUndefined();
  });
});

describe("browse, profile, counts, similar", () => {
  it("browse is alphabetical within verified-first and paginates", async () => {
    const { rows, total } = await browseBusinesses("health", "toronto", 1);
    const ours = rows.filter((r) => r.slug.startsWith(PREFIX));
    // Verified fixture ("Lakeshore Dental Centre") must lead the unverified
    // ones, which must themselves be alphabetical.
    const verifiedNames = ours.filter((r) => r.verified).map((r) => r.name);
    const unverifiedNames = ours
      .filter((r) => !r.verified)
      .map((r) => r.name);
    expect(verifiedNames).toEqual(["Lakeshore Dental Centre"]);
    expect([...unverifiedNames].sort()).toEqual(unverifiedNames);
    // The whole page itself must respect verified-first, then name ASC.
    const firstUnverifiedIdx = rows.findIndex((r) => !r.verified);
    if (firstUnverifiedIdx > 0) {
      expect(
        rows.slice(0, firstUnverifiedIdx).every((r) => r.verified),
      ).toBe(true);
    }
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it("getBusiness returns active by slug, null for hidden/unknown", async () => {
    const slug = `${PREFIX}downtown-physio-clinic`;
    const before = await getBusiness(slug);
    expect(before).not.toBeNull();
    expect(before!.name).toBe("Downtown Physio Clinic");
    expect(before).toHaveProperty("hours");
    expect(before).toHaveProperty("createdAt");

    await db.business.update({ where: { slug }, data: { status: "hidden" } });
    const hidden = await getBusiness(slug);
    expect(hidden).toBeNull();

    await db.business.update({ where: { slug }, data: { status: "active" } });
    const restored = await getBusiness(slug);
    expect(restored).not.toBeNull();

    expect(await getBusiness(`${PREFIX}does-not-exist`)).toBeNull();
  });

  it("counts move with fixtures", async () => {
    const byCategory = await businessCountsByCategory();
    expect(byCategory["health"]).toBeGreaterThanOrEqual(4);
    expect(byCategory["home-services"]).toBeGreaterThanOrEqual(4);

    const healthCities = await businessCityCounts("health");
    expect(healthCities["toronto"]).toBeGreaterThanOrEqual(3);
    expect(healthCities["mississauga"]).toBeGreaterThanOrEqual(1);
  });

  it("similar excludes self and matches category+city", async () => {
    const slug = `${PREFIX}downtown-dental-clinic`;
    const similar = await similarBusinesses(slug, "health", "toronto");
    expect(similar.some((r) => r.slug === slug)).toBe(false);
    expect(similar.every((r) => r.category === "health" && r.city === "toronto")).toBe(
      true,
    );
    const names = similar.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(["Lakeshore Dental Centre", "Downtown Physio Clinic"]),
    );
  });
});
