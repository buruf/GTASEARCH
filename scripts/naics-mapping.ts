// NAICS (North American Industry Classification System) -> GTASearch taxonomy.
//
// Why this file is the important one: every GTA regional business directory
// (Mississauga, Brampton, York Region, Durham) codes its records with NAICS,
// unlike Toronto's municipal feed which uses bespoke licence classes. NAICS is
// a published standard, so mapping it is reading the data rather than guessing
// at it — and one mapping serves every region we add.
//
// SCOPE RULE: only consumer-facing industries are listed. A directory user is
// looking for somewhere to go or someone to hire. Wholesalers, manufacturers,
// freight, holding companies, staffing agencies and head offices are all real
// businesses but nobody searches a local directory for them, so they are left
// unmapped and skipped rather than dumped into a category.
//
// PRIVACY RULE: see HOME_BASED_RISK below. Phase 5A refused to import Toronto's
// trade licences because those addresses are overwhelmingly the tradesperson's
// own home, and publishing a home address in a public business directory is not
// something a directory should do. Regional directories carry the same hazard —
// "PEEK MOVING SYSTEMS, 4 JUNIPER CRES" is a house — so trades are admitted
// only with a corroborating commercial signal.

export interface NaicsMappingEntry {
  category: string;
  subcategory?: string;
}

/**
 * Six-digit NAICS codes. Longest match wins: the importer tries the full
 * 6-digit code, then the 5-digit, then the 4-digit prefix, so a code we did
 * not enumerate still lands correctly if its industry group is mapped.
 */
export const NAICS_MAPPING: Record<string, NaicsMappingEntry> = {
  // ---- restaurants ---------------------------------------------------
  "7225": { category: "restaurants" },
  "722511": { category: "restaurants" },
  "722512": { category: "restaurants", subcategory: "fast-food" },
  "722513": { category: "restaurants", subcategory: "fast-food" },
  "722514": { category: "restaurants", subcategory: "fast-food" },
  "722515": { category: "restaurants", subcategory: "coffee-tea" },
  "311811": { category: "restaurants", subcategory: "bakeries" },
  "722410": { category: "restaurants" },
  "445291": { category: "restaurants", subcategory: "bakeries" },
  "445230": { category: "restaurants", subcategory: "grocery" },
  "445110": { category: "restaurants", subcategory: "grocery" },
  "445131": { category: "restaurants", subcategory: "grocery" },
  "445132": { category: "restaurants", subcategory: "grocery" },

  // ---- health --------------------------------------------------------
  "621210": { category: "health", subcategory: "dentists" },
  "621110": { category: "health", subcategory: "family-doctors" },
  "621494": { category: "health", subcategory: "walk-in-clinics" },
  "621310": { category: "health", subcategory: "chiropractors" },
  "621320": { category: "health", subcategory: "optometrists" },
  "621340": { category: "health", subcategory: "physiotherapy" },
  "446110": { category: "health", subcategory: "pharmacies" },
  "456110": { category: "health", subcategory: "pharmacies" },
  "621330": { category: "health" },
  "621391": { category: "health" },
  "621399": { category: "health" },
  "621420": { category: "health" },

  // ---- home services -------------------------------------------------
  // Every code here is HOME_BASED_RISK — see the set below.
  "238220": { category: "home-services", subcategory: "plumbers" },
  "238210": { category: "home-services", subcategory: "electricians" },
  "238310": { category: "home-services" },
  "238320": { category: "home-services", subcategory: "painters" },
  "238160": { category: "home-services", subcategory: "roofing" },
  "561730": { category: "home-services", subcategory: "landscaping" },
  "561720": { category: "home-services", subcategory: "cleaning" },
  "484210": { category: "home-services", subcategory: "movers" },
  "238990": { category: "home-services", subcategory: "handyman" },
  "236118": { category: "home-services" },

  // ---- beauty --------------------------------------------------------
  "812111": { category: "beauty", subcategory: "barbers" },
  "812112": { category: "beauty", subcategory: "hair-salons" },
  "812113": { category: "beauty", subcategory: "nail-salons" },
  "812114": { category: "beauty" },
  "812115": { category: "beauty" },
  "812190": { category: "beauty" },

  // ---- automotive ----------------------------------------------------
  "8111": { category: "automotive", subcategory: "auto-repair" },
  "811111": { category: "automotive", subcategory: "auto-repair" },
  "811112": { category: "automotive", subcategory: "auto-repair" },
  "811121": { category: "automotive", subcategory: "body-shops" },
  "811122": { category: "automotive", subcategory: "body-shops" },
  "811192": { category: "automotive", subcategory: "car-wash" },
  "441320": { category: "automotive", subcategory: "tires" },
  "441330": { category: "automotive", subcategory: "tires" },

  // ---- professional --------------------------------------------------
  "541110": { category: "professional", subcategory: "lawyers" },
  "541212": { category: "professional", subcategory: "accountants" },
  "541213": { category: "professional", subcategory: "accountants" },
  "531210": { category: "professional", subcategory: "real-estate-agents" },
  "524210": { category: "professional", subcategory: "insurance" },
  "522310": { category: "professional", subcategory: "mortgage-brokers" },
  "541810": { category: "professional", subcategory: "marketing" },
  "541820": { category: "professional", subcategory: "marketing" },
  "541613": { category: "professional", subcategory: "marketing" },

  // ---- shopping ------------------------------------------------------
  "458110": { category: "shopping", subcategory: "clothing" },
  "448140": { category: "shopping", subcategory: "clothing" },
  "449110": { category: "shopping", subcategory: "furniture-stores" },
  "442110": { category: "shopping", subcategory: "furniture-stores" },
  "449210": { category: "shopping", subcategory: "electronics-stores" },
  "443142": { category: "shopping", subcategory: "electronics-stores" },
  "458310": { category: "shopping", subcategory: "jewellery" },
  "448310": { category: "shopping", subcategory: "jewellery" },
  "459310": { category: "shopping", subcategory: "florists" },
  "453110": { category: "shopping", subcategory: "florists" },

  // ---- education -----------------------------------------------------
  "624410": { category: "education", subcategory: "daycares" },
  "611710": { category: "education", subcategory: "tutoring-centres" },
  "611691": { category: "education", subcategory: "tutoring-centres" },
  "611519": { category: "education" },
  "611610": { category: "education", subcategory: "music-lessons" },
  "611620": { category: "education" },
  "611511": { category: "education", subcategory: "driving-schools" },

  // ---- fitness -------------------------------------------------------
  "713940": { category: "fitness", subcategory: "gyms" },
  "713910": { category: "fitness", subcategory: "sports-clubs" },
  "713950": { category: "fitness", subcategory: "sports-clubs" },
  "713990": { category: "fitness", subcategory: "sports-clubs" },

  // ---- pets ----------------------------------------------------------
  "541940": { category: "pets", subcategory: "veterinarians" },
  "812910": { category: "pets", subcategory: "grooming" },
  "459910": { category: "pets", subcategory: "pet-stores" },
  "453910": { category: "pets", subcategory: "pet-stores" },
};

/**
 * Industries where the registered address is very often the owner's house.
 * A record in one of these is imported ONLY with a corroborating commercial
 * signal (a website, or more than a handful of employees) — see
 * hasCommercialSignal. This is the same line Phase 5A drew, applied to a
 * richer dataset that lets us keep the genuine storefront firms instead of
 * dropping the whole trade.
 */
export const HOME_BASED_RISK = new Set([
  "238220", "238210", "238310", "238320", "238160",
  "561730", "561720", "484210", "238990", "236118",
]);

/** Street types that are almost always residential subdivisions. */
const RESIDENTIAL_STREET = /\b(CRES|CRESCENT|CRT|COURT|PLACE|TERR|TERRACE|MEWS|GATE|GDNS|GARDENS)\b/i;

export function looksResidential(address: string): boolean {
  return RESIDENTIAL_STREET.test(address);
}

/**
 * True when a home-based-risk record carries evidence of being a real
 * commercial operation rather than a name on a house: a published website, or
 * a staff count above a one-or-two-person operation. Employee ranges arrive as
 * free text ("1 to 4", "1-4", "10-19"), so we read the FIRST number and treat
 * anything above 4 as a business with premises.
 */
export function hasCommercialSignal(
  website: string | null,
  employeeRange: string | null,
): boolean {
  if (website && website.trim().length > 3) return true;
  if (employeeRange) {
    const first = employeeRange.match(/\d+/);
    if (first && Number(first[0]) > 4) return true;
  }
  return false;
}

/**
 * Longest-prefix NAICS lookup. Codes arrive as numbers or strings and
 * occasionally with trailing detail, so everything is normalised to digits
 * first. Returns null for anything unmapped — the caller must skip, never
 * guess a category.
 */
export function lookupNaics(code: string | number | null | undefined): NaicsMappingEntry | null {
  if (code === null || code === undefined) return null;
  const digits = String(code).replace(/\D/g, "");
  if (!digits) return null;
  for (const len of [6, 5, 4]) {
    if (digits.length >= len) {
      const hit = NAICS_MAPPING[digits.slice(0, len)];
      if (hit) return hit;
    }
  }
  return null;
}
