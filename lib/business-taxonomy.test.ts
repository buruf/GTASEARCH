import { describe, it, expect } from "vitest";
import { BUSINESS_CATEGORIES, getBusinessCategory, getBusinessCategoryLabel, getBusinessSubcategoryLabel } from "@/lib/business-categories";
import { makeBusinessSlug } from "@/lib/business-slug";
import { getCity } from "@/lib/cities";

describe("business taxonomy", () => {
  // Ten from the Phase 5A spec, plus "religion" (Places of Worship), added
  // Aug 3 2026 once open data proved it could actually be populated.
  it("has the eleven categories with unique slugs", () => {
    expect(BUSINESS_CATEGORIES).toHaveLength(11);
    const slugs = BUSINESS_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(11);
    expect(slugs).toContain("restaurants");
    expect(slugs).toContain("home-services");
    expect(slugs).toContain("religion");
  });
  it("every category has subcategories with unique slugs", () => {
    for (const c of BUSINESS_CATEGORIES) {
      expect(c.subcategories.length).toBeGreaterThanOrEqual(4);
      const s = c.subcategories.map((x) => x.slug);
      expect(new Set(s).size).toBe(s.length);
    }
  });
  it("lookup helpers degrade instead of throwing", () => {
    expect(getBusinessCategory("nope")).toBeUndefined();
    expect(getBusinessCategoryLabel("nope")).toBe("nope");
    expect(getBusinessSubcategoryLabel("health", "nope")).toBe("nope");
    expect(getBusinessCategory("health")?.label).toBe("Health & Medical");
  });
});

describe("makeBusinessSlug", () => {
  it("kebabs name and appends city", () => {
    expect(makeBusinessSlug("Mamma's Pizza & Grill", "toronto")).toBe("mammas-pizza-grill-toronto");
  });
  it("handles unicode and squeezes punctuation runs", () => {
    expect(makeBusinessSlug("Café  Crème!!!", "vaughan")).toBe("cafe-creme-vaughan");
  });
  it("handles curly apostrophes", () => {
    expect(makeBusinessSlug("O'Brien's Pub", "toronto")).toBe("obriens-pub-toronto");
  });
  it("caps the name part at 60 chars", () => {
    const s = makeBusinessSlug("x".repeat(100), "ajax");
    expect(s.length).toBeLessThanOrEqual(60 + 1 + "ajax".length);
  });
  it("city slugs used are real", () => {
    expect(getCity("toronto")).toBeDefined();
  });
});
