import { describe, it, expect } from "vitest";
import { LICENCE_MAPPING } from "@/scripts/toronto-licence-mapping";
import {
  BODYSAFE_SERVICE_MAPPING,
  CHILDCARE_MAPPING,
  pickPrimaryServiceType,
  refineSubcategory,
} from "@/scripts/toronto-health-mapping";
import { cleanName, isPlausibleStreetAddress } from "@/scripts/import-helpers";
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

describe("Toronto Public Health mapping", () => {
  it("every BodySafe service type resolves to a real category and subcategory", () => {
    for (const [srvType, entry] of Object.entries(BODYSAFE_SERVICE_MAPPING)) {
      const category = getBusinessCategory(entry.category);
      expect(category, `"${srvType}" maps to unknown category "${entry.category}"`).toBeDefined();
      if (entry.subcategory) {
        const found = category!.subcategories.some((s) => s.slug === entry.subcategory);
        expect(found, `"${srvType}" maps to unknown subcategory "${entry.subcategory}"`).toBe(true);
      }
    }
  });

  it("the childcare mapping resolves", () => {
    const category = getBusinessCategory(CHILDCARE_MAPPING.category);
    expect(category).toBeDefined();
    expect(category!.subcategories.some((s) => s.slug === CHILDCARE_MAPPING.subcategory)).toBe(true);
  });

  it("picks the most specific service type when a premises has several", () => {
    expect(pickPrimaryServiceType(["Aesthetics", "Nails"])).toBe("Nails");
    expect(pickPrimaryServiceType(["Aesthetics", "Barbering & Hairdressing"])).toBe(
      "Barbering & Hairdressing",
    );
    expect(pickPrimaryServiceType(["Aesthetics", "Tattooing", "Nails"])).toBe("Tattooing");
  });

  it("ignores service types it does not know rather than guessing", () => {
    expect(pickPrimaryServiceType(["Something New"])).toBeNull();
    expect(pickPrimaryServiceType([])).toBeNull();
  });

  it("lets the business's own name override the service stream", () => {
    // Inspected under Aesthetics, but the name says what it actually is.
    expect(refineSubcategory("TIMELESS INK TATTOO", "Aesthetics")).toBe("tattoo-piercing");
    expect(refineSubcategory("RYNA'S NAILS", "Aesthetics")).toBe("nail-salons");
    expect(refineSubcategory("JOE'S BARBER SHOP", "Aesthetics")).toBe("barbers");
  });

  it("prefers the leading trade when a name carries several signals", () => {
    expect(refineSubcategory("HAIR 1ST CLASS & SPA", "Aesthetics")).toBe("hair-salons");
    expect(refineSubcategory("SUNSHINE SPA & NAILS", "Aesthetics")).toBe("nail-salons");
    expect(refineSubcategory("BEAUTY ELEMENTS MEDICAL SPA", "Aesthetics")).toBe("spas");
  });

  it("falls back to hair-salons for an unrevealing Barbering & Hairdressing name", () => {
    expect(refineSubcategory("JUICE", "Barbering & Hairdressing")).toBe("hair-salons");
  });

  it("leaves ambiguous Aesthetics rows without a subcategory", () => {
    expect(refineSubcategory("CLASSIC STUDIO BY TETYANA", "Aesthetics")).toBeNull();
    expect(refineSubcategory("EVER BEAUTY CLINIC", "Injectable Personal Services")).toBeNull();
  });
});

describe("import helpers", () => {
  it("strips corporate suffixes and title-cases", () => {
    expect(cleanName("SCOOT INK LTD")).toBe("Scoot Ink");
    expect(cleanName("PRO NAILS & SPA")).toBe("Pro Nails & Spa");
  });

  it("requires a street-number-led address", () => {
    expect(isPlausibleStreetAddress("6620 FINCH AVE W, UNIT-10A")).toBe(true);
    expect(isPlausibleStreetAddress("UNIT 4")).toBe(false);
    expect(isPlausibleStreetAddress("")).toBe(false);
    expect(isPlausibleStreetAddress(null)).toBe(false);
  });
});
