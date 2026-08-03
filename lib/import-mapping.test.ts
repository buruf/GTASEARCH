import { describe, it, expect } from "vitest";
import { LICENCE_MAPPING } from "@/scripts/toronto-licence-mapping";
import {
  BODYSAFE_SERVICE_MAPPING,
  CHILDCARE_MAPPING,
  pickPrimaryServiceType,
  refineSubcategory,
} from "@/scripts/toronto-health-mapping";
import {
  cleanName,
  isPlausibleStreetAddress,
  normalizeWebsite,
  preferOperatingName,
  repairMojibake,
} from "@/scripts/import-helpers";
import {
  NAICS_MAPPING,
  HOME_BASED_RISK,
  PREMISES_CATEGORIES,
  hasCommercialSignal,
  hasUnitDesignator,
  lookupNaics,
  looksLikePersonalName,
  looksResidential,
} from "@/scripts/naics-mapping";
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

  it("repairs CP437 mojibake without touching legitimate punctuation", () => {
    expect(repairMojibake("Caf‚ Vilamor")).toBe("Café Vilamor");
    expect(repairMojibake("Gar‡on")).toBe("Garçon");
    // En dashes and ellipses are real in business names — must survive.
    expect(repairMojibake("Foo – Bar")).toBe("Foo – Bar");
    expect(repairMojibake("Wait…")).toBe("Wait…");
  });

  it("prefers the operating name over a numbered holding company", () => {
    expect(preferOperatingName("2223722 Ontario Inc. O/A Kate's Bakery")).toBe("Kate's Bakery");
    expect(preferOperatingName("Plain Business Name")).toBe("Plain Business Name");
    expect(cleanName("2223722 ONTARIO INC. O/A KATE'S BAKERY")).toBe("Kate's Bakery");
  });

  it("gives bare website values a scheme so they are not relative links", () => {
    expect(normalizeWebsite("clasicobarber.com")).toBe("https://clasicobarber.com");
    expect(normalizeWebsite("www.example.ca/page")).toBe("https://www.example.ca/page");
    expect(normalizeWebsite("https://already.com")).toBe("https://already.com");
    expect(normalizeWebsite("n/a")).toBeNull();
    expect(normalizeWebsite(null)).toBeNull();
  });
});

describe("NAICS mapping", () => {
  it("every entry resolves to a real category and subcategory", () => {
    for (const [code, entry] of Object.entries(NAICS_MAPPING)) {
      const category = getBusinessCategory(entry.category);
      expect(category, `NAICS ${code} -> unknown category "${entry.category}"`).toBeDefined();
      if (entry.subcategory) {
        const found = category!.subcategories.some((s) => s.slug === entry.subcategory);
        expect(found, `NAICS ${code} -> unknown subcategory "${entry.subcategory}"`).toBe(true);
      }
    }
  });

  it("keys are digits only, so longest-prefix lookup can match them", () => {
    for (const code of Object.keys(NAICS_MAPPING)) {
      expect(/^\d{4,6}$/.test(code), `"${code}" is not a 4-6 digit NAICS code`).toBe(true);
    }
  });

  it("looks up exact codes and falls back to the industry-group prefix", () => {
    expect(lookupNaics(621210)).toEqual({ category: "health", subcategory: "dentists" });
    expect(lookupNaics("812111")).toEqual({ category: "beauty", subcategory: "barbers" });
    // 722519 is not enumerated; the 7225 group is.
    expect(lookupNaics("722519")).toEqual({ category: "restaurants" });
    expect(lookupNaics("339999")).toBeNull();
    expect(lookupNaics(null)).toBeNull();
  });

  it("every home-based-risk code is actually mapped", () => {
    for (const code of HOME_BASED_RISK) {
      expect(NAICS_MAPPING[code], `${code} flagged risky but not mapped`).toBeDefined();
    }
  });

  it("admits a trade only with evidence of commercial premises", () => {
    expect(hasCommercialSignal("https://acme-plumbing.ca", "1 to 4")).toBe(true);
    expect(hasCommercialSignal(null, "10-19")).toBe(true);
    expect(hasCommercialSignal(null, "1 to 4")).toBe(false);
    expect(hasCommercialSignal(null, null)).toBe(false);
  });

  it("treats a real person's name as personal information", () => {
    expect(looksLikePersonalName("Stephanie Van Mil")).toBe(true);
    expect(looksLikePersonalName("Michael J. Walsh")).toBe(true);
  });

  it("does NOT mistake two-word trading names for people", () => {
    // An earlier draft flagged all of these and would have hidden 1,235 real
    // businesses — the given-name requirement is what fixed it.
    for (const trading of [
      "Fade Room",
      "Waxon Waxbar",
      "Scoot Ink",
      "Learner Drivers",
      "Timeless Ink",
      "Urban Curls",
      "Glow Beauty Bar",
    ]) {
      expect(looksLikePersonalName(trading), `"${trading}" flagged as a person`).toBe(false);
    }
  });

  it("relies on the category guard for trading names that start with a given name", () => {
    // "Tim Hortons" is indistinguishable from a person by name alone, and the
    // name test does flag it. What protects it is that restaurants are
    // premises by nature, so the gate is never applied to that category.
    expect(looksLikePersonalName("Tim Hortons")).toBe(true);
    expect(PREMISES_CATEGORIES.has("restaurants")).toBe(true);
    expect(PREMISES_CATEGORIES.has("automotive")).toBe(true);
    expect(PREMISES_CATEGORIES.has("shopping")).toBe(true);
  });

  it("does not flag names carrying a business word", () => {
    expect(looksLikePersonalName("Robert Smith Dentistry")).toBe(false);
    expect(looksLikePersonalName("2223722 Ontario Inc")).toBe(false);
  });

  it("reads unit designators as evidence of commercial premises", () => {
    expect(hasUnitDesignator("45 WICKSTEED AVE, UNIT-280-1")).toBe(true);
    expect(hasUnitDesignator("415 YONGE ST, Suite 102")).toBe(true);
    expect(hasUnitDesignator("11 Spruce Street")).toBe(false);
  });

  it("spots residential street types", () => {
    expect(looksResidential("4 JUNIPER CRES")).toBe(true);
    expect(looksResidential("12 SOMEWHERE COURT")).toBe(true);
    expect(looksResidential("3480 PLATINUM DR")).toBe(false);
  });
});
