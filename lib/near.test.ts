import { describe, it, expect } from "vitest";
import { isPlausibleGtaPoint, parseNearParams, formatDistance } from "@/lib/near";

describe("near-me coordinate validation", () => {
  it("accepts points in the GTA", () => {
    expect(isPlausibleGtaPoint(43.6453, -79.3806)).toBe(true); // Union Station
    expect(isPlausibleGtaPoint(43.8971, -78.8658)).toBe(true); // Oshawa
  });

  // A swapped lat/lng is the classic geocoding bug: (-79.38, 43.64) is in the
  // Southern Ocean. It must never reach SQL.
  it("rejects swapped coordinates", () => {
    expect(isPlausibleGtaPoint(-79.3806, 43.6453)).toBe(false);
  });

  it("rejects non-finite values from query strings", () => {
    expect(isPlausibleGtaPoint(NaN, -79.38)).toBe(false);
    expect(isPlausibleGtaPoint(43.6, Infinity)).toBe(false);
  });

  it("rejects points far outside the region", () => {
    expect(isPlausibleGtaPoint(51.5074, -0.1278)).toBe(false); // London
    expect(isPlausibleGtaPoint(45.5019, -73.5674)).toBe(false); // Montreal
  });
});

describe("parseNearParams", () => {
  it("reads valid params and defaults the radius", () => {
    expect(parseNearParams({ lat: "43.6453", lng: "-79.3806" })).toEqual({
      latitude: 43.6453,
      longitude: -79.3806,
      radiusKm: 5,
    });
  });

  it("clamps the radius rather than trusting it", () => {
    expect(parseNearParams({ lat: "43.6", lng: "-79.4", radius: "999" })?.radiusKm).toBe(25);
    expect(parseNearParams({ lat: "43.6", lng: "-79.4", radius: "0" })?.radiusKm).toBe(1);
    expect(parseNearParams({ lat: "43.6", lng: "-79.4", radius: "abc" })?.radiusKm).toBe(5);
  });

  // Returning null, not a clamped Toronto point: snapping a traveller's
  // location to downtown would show them results hundreds of km away as
  // though they were nearby.
  it("returns null for a point outside the GTA rather than snapping it", () => {
    expect(parseNearParams({ lat: "51.5074", lng: "-0.1278" })).toBeNull();
    expect(parseNearParams({ lat: "", lng: "" })).toBeNull();
  });
});

describe("formatDistance", () => {
  it("uses metres below a kilometre", () => {
    expect(formatDistance(0.008)).toBe("8 m");
    expect(formatDistance(0.45)).toBe("450 m");
  });

  it("uses one decimal kilometre above that", () => {
    expect(formatDistance(1.24)).toBe("1.2 km");
    expect(formatDistance(12)).toBe("12.0 km");
  });
});
