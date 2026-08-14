import { describe, it, expect } from "vitest";
import { parseLocation, eventSlug } from "@/scripts/import-toronto-events";

describe("Toronto events import", () => {
  // event_locations is an array of OBJECTS. Reading it as text stringified
  // "[object Object]", matched no city, and discarded all 5,384 live events.
  it("reads venue and address out of the location object", () => {
    const loc = parseLocation([
      {
        location_name: "Toronto Sculpture Garden",
        location_address: "115 King St E, Toronto, ON, M5C 1G6",
      },
    ]);
    expect(loc.venueName).toBe("Toronto Sculpture Garden");
    expect(loc.address).toContain("115 King St E");
    expect(loc.city).toBe("toronto");
  });

  // A postal code is better evidence than any text match, and it is what
  // separates the Toronto districts from Toronto proper.
  it("prefers the postal code, so districts resolve", () => {
    expect(
      parseLocation([{ location_address: "1 Colonel Samuel Smith Park Dr, ON M8V 4B6" }]).city,
    ).toBe("etobicoke");
    expect(
      parseLocation([{ location_address: "2 Some Rd, ON M1B 1A1" }]).city,
    ).toBe("scarborough");
  });

  // "115 King St E" is a Toronto street, not King Township. A substring match
  // filed it under King and this is the guard against that returning.
  it("matches whole address components, not substrings", () => {
    expect(parseLocation([{ location_address: "115 King St E, Toronto" }]).city).toBe("toronto");
    // A genuine King Township address still resolves.
    expect(parseLocation([{ location_address: "2585 King Rd, King, ON" }]).city).toBe("king");
  });

  // Some venues are published as a boundary with no street address at all.
  // The source is the City of Toronto's own calendar, so Toronto is a sound
  // default — dropping them would lose real events over a missing field.
  it("falls back to Toronto when there is no address", () => {
    expect(parseLocation([{ location_name: "Kensington Market", location_address: "" }]).city).toBe("toronto");
    expect(parseLocation(null).city).toBe("toronto");
  });

  it("slugs by name, city and year, since festivals recur annually", () => {
    expect(eventSlug("Taste of the Danforth", "toronto", new Date("2026-08-08"))).toBe(
      "taste-of-the-danforth-toronto-2026",
    );
    expect(eventSlug("Nuit Blanche", "toronto", new Date("2027-10-02"))).toBe(
      "nuit-blanche-toronto-2027",
    );
  });
});
