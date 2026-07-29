// GTA cities served by the platform, with representative neighbourhoods used
// for seed data and for the neighbourhood autocomplete in Phase 2.

export interface City {
  slug: string;
  label: string;
  neighbourhoods: string[];
}

export const CITIES: City[] = [
  {
    slug: "toronto",
    label: "Toronto",
    neighbourhoods: [
      "Downtown",
      "The Annex",
      "Liberty Village",
      "Leslieville",
      "High Park",
      "Little Italy",
      "The Beaches",
      "Yorkville",
    ],
  },
  {
    slug: "mississauga",
    label: "Mississauga",
    neighbourhoods: [
      "Square One",
      "Port Credit",
      "Streetsville",
      "Meadowvale",
      "Erin Mills",
      "Clarkson",
    ],
  },
  {
    slug: "brampton",
    label: "Brampton",
    neighbourhoods: [
      "Bramalea",
      "Heart Lake",
      "Springdale",
      "Mount Pleasant",
      "Downtown Brampton",
    ],
  },
  {
    slug: "markham",
    label: "Markham",
    neighbourhoods: [
      "Unionville",
      "Cornell",
      "Milliken Mills",
      "Thornhill",
      "Markham Village",
    ],
  },
  {
    slug: "vaughan",
    label: "Vaughan",
    neighbourhoods: [
      "Woodbridge",
      "Maple",
      "Concord",
      "Kleinburg",
      "Vaughan Metropolitan Centre",
    ],
  },
  {
    slug: "richmond-hill",
    label: "Richmond Hill",
    neighbourhoods: ["Oak Ridges", "Bayview Hill", "Mill Pond", "Observatory"],
  },
  {
    slug: "scarborough",
    label: "Scarborough",
    neighbourhoods: [
      "Agincourt",
      "Guildwood",
      "Malvern",
      "Birch Cliff",
      "Rouge",
    ],
  },
  {
    slug: "etobicoke",
    label: "Etobicoke",
    neighbourhoods: [
      "Mimico",
      "The Kingsway",
      "Long Branch",
      "Rexdale",
      "Humber Bay",
    ],
  },
  {
    slug: "oakville",
    label: "Oakville",
    neighbourhoods: ["Bronte", "Glen Abbey", "Old Oakville", "River Oaks"],
  },
  {
    slug: "burlington",
    label: "Burlington",
    neighbourhoods: ["Aldershot", "Millcroft", "Roseland", "Alton Village"],
  },
  {
    slug: "ajax",
    label: "Ajax",
    neighbourhoods: ["South Ajax", "Nottingham", "Westney Heights"],
  },
  {
    slug: "pickering",
    label: "Pickering",
    neighbourhoods: ["Bay Ridges", "Amberlea", "Rougemount", "Brock Ridge"],
  },
  {
    slug: "oshawa",
    label: "Oshawa",
    neighbourhoods: ["Downtown Oshawa", "Taunton", "Lakeview", "Windfields"],
  },
  {
    slug: "newmarket",
    label: "Newmarket",
    neighbourhoods: ["Glenway", "Stonehaven", "Bristol-London", "Armitage"],
  },
  {
    slug: "barrie",
    label: "Barrie",
    neighbourhoods: ["Allandale", "Painswick", "Holly", "East Bayfield"],
  },
];

const CITY_BY_SLUG = new Map(CITIES.map((c) => [c.slug, c]));

/** Unknown slugs return undefined; callers drop the filter rather than throw. */
export function getCity(slug: string | undefined): City | undefined {
  return slug ? CITY_BY_SLUG.get(slug) : undefined;
}

export function getCityLabel(slug: string): string {
  return CITY_BY_SLUG.get(slug)?.label ?? slug;
}

/** Filters a list of candidate slugs down to those that exist. */
export function validCitySlugs(slugs: string[]): string[] {
  return slugs.filter((s) => CITY_BY_SLUG.has(s));
}
