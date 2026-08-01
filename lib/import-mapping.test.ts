import { describe, it, expect } from "vitest";
import { LICENCE_MAPPING } from "@/scripts/toronto-licence-mapping";
import { getBusinessCategory } from "@/lib/business-categories";

describe("Toronto licence-category mapping", () => {
  it("is non-empty", () => {
    expect(Object.keys(LICENCE_MAPPING).length).toBeGreaterThan(0);
  });

  it("every entry's category resolves via getBusinessCategory, and its subcategory (if any) exists within it", () => {
    for (const [licenceClass, entry] of Object.entries(LICENCE_MAPPING)) {
      const category = getBusinessCategory(entry.category);
      expect(category, `"${licenceClass}" maps to unknown category "${entry.category}"`).toBeDefined();

      if (entry.subcategory) {
        const found = category!.subcategories.some((s) => s.slug === entry.subcategory);
        expect(
          found,
          `"${licenceClass}" maps to unknown subcategory "${entry.subcategory}" within category "${entry.category}"`,
        ).toBe(true);
      }
    }
  });

  it("has no duplicate licence-class keys with different casing", () => {
    const upper = Object.keys(LICENCE_MAPPING).map((k) => k.toUpperCase());
    expect(new Set(upper).size).toBe(upper.length);
  });
});
