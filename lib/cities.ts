// GTA cities served by the platform, with representative neighbourhoods used
// for seed data and for the neighbourhood autocomplete in Phase 2.
//
// ARRAY ORDER IS THE CANONICAL DISPLAY ORDER, roughly largest municipality
// first. Do not reorder casually — city lists across the directory sort by
// cityRank() below rather than by how many businesses we happen to hold.
//
// Why that matters: coverage per city reflects what each municipality
// PUBLISHES, not how much commerce it has. Toronto releases licences and
// health inspections — and the City does not license doctors, lawyers or
// accountants, so it has none of them — while York, Peel and Durham publish
// full business directories. Sorting city lists by listing count therefore
// told visitors that Markham is a larger commercial centre than Toronto,
// which is plainly false. The counts are still shown beside each city, since
// those are honest; they simply no longer decide the running order.

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
  // The remaining York Region municipalities, added when the York Region
  // business directory brought real listings for each of them. Without these
  // the importer would have discarded thousands of genuine GTA businesses for
  // having a city we simply had not listed yet.
  {
    slug: "aurora",
    label: "Aurora",
    neighbourhoods: ["Aurora Village", "Bayview Wellington", "Aurora Highlands"],
  },
  {
    slug: "whitchurch-stouffville",
    label: "Whitchurch-Stouffville",
    neighbourhoods: ["Stouffville", "Ballantrae", "Musselman's Lake"],
  },
  {
    slug: "georgina",
    label: "Georgina",
    neighbourhoods: ["Keswick", "Sutton", "Jackson's Point", "Pefferlaw"],
  },
  {
    slug: "east-gwillimbury",
    label: "East Gwillimbury",
    neighbourhoods: ["Holland Landing", "Sharon", "Mount Albert", "Queensville"],
  },
  {
    slug: "king",
    label: "King",
    neighbourhoods: ["King City", "Nobleton", "Schomberg"],
  },
  // Durham Region municipalities, added alongside the Durham business
  // directory import for the same reason as the York additions above.
  {
    slug: "whitby",
    label: "Whitby",
    neighbourhoods: ["Brooklin", "Downtown Whitby", "Rolling Acres", "Port Whitby"],
  },
  {
    slug: "clarington",
    label: "Clarington",
    neighbourhoods: ["Bowmanville", "Courtice", "Newcastle", "Orono"],
  },
  {
    slug: "uxbridge",
    label: "Uxbridge",
    neighbourhoods: ["Uxbridge Village", "Goodwood", "Zephyr"],
  },
  {
    slug: "scugog",
    label: "Scugog",
    neighbourhoods: ["Port Perry", "Caesarea", "Blackstock"],
  },
  {
    slug: "brock",
    label: "Brock",
    neighbourhoods: ["Beaverton", "Cannington", "Sunderland"],
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

const CITY_RANK = new Map(CITIES.map((c, i) => [c.slug, i]));

/**
 * Canonical position of a city in every list we render, taken from the order
 * of CITIES (largest municipality first). Unknown slugs sort last.
 *
 * Use this instead of sorting by listing count. See the header of this file:
 * count reflects what a municipality publishes, not its size, so ranking by
 * it misinforms the reader about the GTA itself.
 */
export function cityRank(slug: string): number {
  return CITY_RANK.get(slug) ?? Number.MAX_SAFE_INTEGER;
}

/** Filters a list of candidate slugs down to those that exist. */
export function validCitySlugs(slugs: string[]): string[] {
  return slugs.filter((s) => CITY_BY_SLUG.has(s));
}
