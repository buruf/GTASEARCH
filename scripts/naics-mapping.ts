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
  // Specialty food retailers. 445210 "Meat Markets" was missing until
  // Aug 3 2026, which silently dropped every dedicated butcher in every
  // source — four of Brampton's eight halal meat shops were lost to this
  // alone. 445220/445250 are its siblings under 4452 and were missing too.
  "445210": { category: "restaurants", subcategory: "grocery" }, // Meat Markets
  "445220": { category: "restaurants", subcategory: "grocery" }, // Fish and Seafood Markets
  "445250": { category: "restaurants", subcategory: "grocery" }, // Fruit and Vegetable Markets

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

/**
 * Categories whose businesses are premises-based by nature. A restaurant or a
 * tyre shop is not somebody's living room, so the personal-name gate below is
 * not applied to them — which is what keeps two-word trading names like
 * "Tim Hortons" from being mistaken for a private individual.
 */
export const PREMISES_CATEGORIES = new Set(["restaurants", "shopping", "automotive"]);

/** Words that mark a name as a trading name rather than a person's name. */
const BUSINESS_WORD =
  /\b(inc|ltd|limited|corp|corporation|co|llp|llc|group|clinic|dental|dentistry|denture|medicine|medical|health|law|legal|notary|salon|spa|barber|nails?|hair|studio|shop|store|centre|center|caf[eé]|restaurant|pizza|grill|bakery|kitchen|auto|motors|garage|collision|tire|realty|real|estate|insurance|associates?|services?|solutions?|consulting|contracting|construction|plumbing|electric|hvac|roofing|landscaping|cleaning|academy|school|daycare|childcare|learning|tutoring|fitness|gym|yoga|pilates|martial|pet|veterinary|animal|tax|accounting|bookkeeping|agency|enterprises|holdings|management|therapy|therapeutics|wellness|massage|physio|chiro|optical|optometry|pharmacy|drugs?|market|foods?|catering|travel|design|photography|studios)\b/i;

/**
 * Common given names. A "two capitalised words with no business word" test is
 * hopeless on its own — it flags "Fade Room", "Waxon Waxbar" and "Scoot Ink"
 * as people, and an earlier draft of this gate would have hidden 1,235
 * perfectly real businesses. Requiring the FIRST token to be a recognisable
 * given name is what separates "Stephanie Van Mil" from "Scoot Ink".
 *
 * The list is deliberately conservative: missing a name means we publish
 * something we might have held back, which is caught by the other conditions
 * (no website, residential street). A short list that is right beats a long
 * list that guesses.
 */
const GIVEN_NAMES = new Set(
  `aaron adam adrian ahmed aisha alan albert alex alexander alexandra ali alice amanda amir amy ana andrea andrew angela ann anna anne anthony antonio april arthur ashley barbara ben benjamin bernard beth betty bill bob bonnie brad brandon brenda brian bruce bryan carl carlos carmen carol caroline catherine cathy charles cheryl chris christina christine christopher cindy claire claudia colin connie craig crystal cynthia dale dan daniel danielle danny daphne darlene darren dave david dawn dean debbie deborah debra denis denise dennis derek diana diane dina domenic don donald donna dora doreen doris dorothy doug douglas dylan ed eddie edward eileen elaine eleanor elena elizabeth ellen emily emma eric erica erin ernest esther eugene eva evelyn faith farah fatima felix fernando florence frank fred frederick gail gary gene george gerald geraldine gina giovanni gloria gord gordon grace graham grant greg gregory guy hannah harold harry heather hector helen henry holly hong hugh ian ida irene irina isabel ivan jack jackie jacob jacqueline james jamie jan jane janet janice jason jean jeanne jeff jeffrey jennifer jenny jeremy jerry jessica jill jim jo joan joanne jody joe joel john johnny jon jonathan jose joseph josephine joshua joy joyce juan judith judy julia julie justin karen karim kate katherine kathleen kathy katie kay keith kelly ken kenneth kevin kim kimberly kirk kristen kyle larry laura lauren laurie lawrence lee leo leonard leslie li lida linda lisa lloyd lois loretta lori lorna lorraine louis louise lucy luigi luis lynn lynne madeline mai marc marcel marco margaret maria marian marie marilyn mario marion mark marlene martha martin marty mary maureen maurice max maya megan mel melanie melissa michael michele michelle mike mildred milton mina miranda mohamed mohammed monica monique nancy naomi natalie natasha nathan neil nelson nicholas nicole nina noel norma norman olga oliver olivia omar oscar pam pamela pat patricia patrick paul paula pauline pedro peggy peter phil philip phyllis rachel rafael ralph ramona randy raymond rebecca regina rene renee ricardo richard rick rita rob robert roberta robin rod roger roland ron ronald rosa rose rosemary roxanne roy ruby russell ruth ryan sabrina sally salvatore sam samantha samir samuel sandra sandy sara sarah scott sean shannon sharon shawn sheila shelley sherry shirley simon sonia sophia stacey stan stanley stella stephanie stephen steve steven stuart sue susan suzanne sylvia tammy tanya ted teresa terry theresa thomas tiffany tim timothy tina todd tom tommy tony tracy travis trevor troy valerie vanessa vera veronica vicki victor victoria vincent violet virginia vivian walter wanda warren wayne wendy wesley william willie wilson yolanda yvonne zachary zoe`
    .split(/\s+/)
    .filter(Boolean),
);

/** Unit / suite designators — a strong hint of a plaza or office, not a house. */
const UNIT_DESIGNATOR = /\b(unit|ste|suite|apt|#|fl|flr|floor|bsmt|lower level|main floor)\b|#\s*\d/i;

export function hasUnitDesignator(address: string): boolean {
  return UNIT_DESIGNATOR.test(address);
}

/**
 * True when a listing name looks like a private individual rather than a
 * trading name — "Stephanie Van Mil", not "Van Mil Massage Therapy".
 *
 * Regional directories register sole proprietors under their own name at their
 * own home: Durham's lists a registered massage therapist by name on a
 * residential street with no website, and publishing that is publishing
 * somebody's home address. York Region's licence explicitly does not cover
 * Personal Information.
 *
 * A true result is not on its own a reason to withhold — callers combine it
 * with the absence of a website and of a unit number, so a practice operating
 * from real commercial premises still gets listed.
 */
export function looksLikePersonalName(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (BUSINESS_WORD.test(n)) return false;
  if (/[0-9&@/]/.test(n)) return false; // numbered co, "A & B", "X/Y" — not a bare person
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 3) return false;
  // Every token must read as a name particle: letters, apostrophes, hyphens,
  // or an initial like "A." — anything else means it is a trading name.
  const allNameLike = words.every((w) =>
    /^[A-Za-zÀ-ÖØ-öø-ÿ]([A-Za-zÀ-ÖØ-öø-ÿ'’-]*)\.?$/.test(w),
  );
  if (!allNameLike) return false;
  return GIVEN_NAMES.has(words[0].toLowerCase().replace(/[.'’-]/g, ""));
}

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
