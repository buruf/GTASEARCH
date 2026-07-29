import { describe, it, expect } from "vitest";
import { parseSearchParams, buildSearchUrl } from "@/lib/search";

describe("parseSearchParams", () => {
  it("reads a normal query string", () => {
    const f = parseSearchParams({
      q: "sofa",
      category: "furniture-home",
      city: "toronto",
      minPrice: "100",
      maxPrice: "900",
      sort: "price-asc",
      page: "2",
    });
    expect(f).toMatchObject({
      q: "sofa",
      category: "furniture-home",
      cities: ["toronto"],
      minPrice: 100,
      maxPrice: 900,
      sort: "price-asc",
      page: 2,
    });
  });

  it("accepts cities as repeated params or comma-separated", () => {
    expect(parseSearchParams({ city: ["toronto", "ajax"] }).cities).toEqual([
      "toronto",
      "ajax",
    ]);
    expect(parseSearchParams({ city: "toronto,ajax" }).cities).toEqual([
      "toronto",
      "ajax",
    ]);
  });

  // Search URLs are user-editable and shareable. None of the following may
  // throw, and none may reach SQL as-is.
  describe("hostile and malformed input", () => {
    it("drops unknown categories and cities instead of filtering on them", () => {
      const f = parseSearchParams({
        category: "'; DROP TABLE listings; --",
        city: ["atlantis", "toronto"],
      });
      expect(f.category).toBeUndefined();
      expect(f.cities).toEqual(["toronto"]);
    });

    it("ignores non-numeric, negative and infinite prices", () => {
      expect(parseSearchParams({ minPrice: "abc" }).minPrice).toBeUndefined();
      expect(parseSearchParams({ minPrice: "-50" }).minPrice).toBeUndefined();
      expect(parseSearchParams({ maxPrice: "Infinity" }).maxPrice).toBeUndefined();
      expect(parseSearchParams({ maxPrice: "" }).maxPrice).toBeUndefined();
    });

    it("swaps an inverted price range rather than returning nothing", () => {
      const f = parseSearchParams({ minPrice: "900", maxPrice: "100" });
      expect(f.minPrice).toBe(100);
      expect(f.maxPrice).toBe(900);
    });

    it("clamps bad page numbers to 1", () => {
      expect(parseSearchParams({ page: "0" }).page).toBe(1);
      expect(parseSearchParams({ page: "-5" }).page).toBe(1);
      expect(parseSearchParams({ page: "abc" }).page).toBe(1);
      expect(parseSearchParams({ page: "2.7" }).page).toBe(2);
    });

    it("falls back to defaults for unknown sort and posted values", () => {
      expect(parseSearchParams({ sort: "cheapest" }).sort).toBe("newest");
      expect(parseSearchParams({ posted: "yesterday" }).posted).toBe("any");
    });

    it("drops unknown listing types", () => {
      expect(parseSearchParams({ type: ["fixed", "bogus"] }).types).toEqual([
        "fixed",
      ]);
    });

    it("caps query length", () => {
      const f = parseSearchParams({ q: "a".repeat(500) });
      expect(f.q.length).toBe(100);
    });

    it("handles a completely empty param set", () => {
      const f = parseSearchParams({});
      expect(f).toMatchObject({ q: "", cities: [], types: [], page: 1 });
    });
  });
});

describe("buildSearchUrl", () => {
  it("omits defaults to keep URLs short and canonical", () => {
    expect(buildSearchUrl({ q: "", cities: [], sort: "newest", page: 1 })).toBe(
      "/search",
    );
  });

  it("round-trips through parseSearchParams", () => {
    const original = parseSearchParams({
      q: "bike",
      category: "sports-outdoors",
      city: ["toronto", "ajax"],
      minPrice: "50",
      sort: "price-desc",
      page: "3",
    });
    const url = buildSearchUrl(original);
    const params = Object.fromEntries(
      new URL(`http://x${url}`).searchParams.entries(),
    );
    // city appears twice, so re-read it as a list
    const cities = new URL(`http://x${url}`).searchParams.getAll("city");
    const reparsed = parseSearchParams({ ...params, city: cities });
    expect(reparsed).toEqual(original);
  });
});
