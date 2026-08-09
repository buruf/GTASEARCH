// Display-cleaning helpers shared by the open-data importers
// (import-toronto-businesses.ts, import-toronto-health-services.ts).
// Extracted so the two feeds can never drift into formatting names and
// addresses differently — they write into the same public directory.

/** Trailing corporate suffixes stripped for display, e.g. "FOO BAR LTD" -> "FOO BAR". */
const CORP_SUFFIX_RE = /[\s,]+(LTD|LIMITED|INC|INCORPORATED|CORP|CORPORATION)\.?$/i;

export function stripCorporateSuffix(raw: string): string {
  let name = raw.trim();
  // Loop in case of stacked suffixes ("... INC LTD").
  let prev: string;
  do {
    prev = name;
    name = name.replace(CORP_SUFFIX_RE, "").trim();
  } while (name !== prev && name.length > 0);
  return name || raw.trim();
}

/** Title-cases a name while leaving punctuation-adjacent letters (e.g. "A&W") capitalized too. */
export function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s\-/&(])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Repairs a specific corruption in the regional directory feeds: accented
 * characters were stored as CP437 bytes and later decoded as CP1252, so "Café"
 * arrives as "Caf‚". Only the substitutions that are never legitimate inside a
 * word are repaired, and only when the character sits against a letter —
 * en dashes, ellipses and curly quotes really do appear in business names, so
 * those are left alone even though they are part of the same corruption
 * family. Better to leave a rare "à" broken than to mangle "Foo – Bar".
 */
const MOJIBAKE: Record<string, string> = {
  "‚": "é", // CP437 0x82
  "‡": "ç", // 0x87
  "Š": "è", // 0x8A
  "Œ": "î", // 0x8C
  "ƒ": "â", // 0x83
};

export function repairMojibake(raw: string): string {
  return raw.replace(/(\p{L})([‚‡ŠŒƒ])/gu, (_m, letter: string, bad: string) =>
    letter + (MOJIBAKE[bad] ?? bad),
  );
}

/**
 * Numbered holding companies register as "2223722 Ontario Inc. O/A Kate's Town
 * Talk Bakery" — the half after "O/A" (operating as) is the name on the sign
 * and the only half a searcher would recognise.
 */
export function preferOperatingName(raw: string): string {
  const m = raw.match(/\bO\/A\b[.\s:]*(.+)$/i);
  if (m && m[1].trim().length >= 3) return m[1].trim();
  return raw;
}

export function cleanName(operatingName: string): string {
  return titleCase(stripCorporateSuffix(repairMojibake(preferOperatingName(operatingName))));
}

/**
 * Directory feeds store websites bare ("clasicobarber.com"). Rendered straight
 * into an href that becomes a same-site relative link, so every one of them
 * would 404. Adds the scheme, and rejects values that are not plausibly a
 * host at all.
 */
export function normalizeWebsite(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().replace(/\s+/g, "");
  if (v.length < 4 || !v.includes(".")) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v) || /^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`;
  return null;
}

export function cleanAddress(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

/**
 * Reads a place of worship's denomination from its own name.
 *
 * NAICS files every congregation under 813110 "Religious Organizations" and
 * records no denomination, so there is nothing in the data to map. What there
 * IS, reliably, is the congregation's chosen name: places of worship name
 * themselves after what they are, far more consistently than ordinary
 * businesses describe their trade.
 *
 * The rule is strict on purpose: a name must contain an unambiguous marker of
 * one faith and no other, otherwise this returns null and the record is filed
 * under Places of Worship with no subcategory. Mislabelling someone's place of
 * worship is a worse failure than leaving it uncategorised, so every doubtful
 * case is left alone. "Temple" alone is deliberately NOT a marker — it is used
 * by Hindu, Buddhist, Sikh, Jewish and Masonic organisations alike.
 */
const RELIGION_MARKERS: [string, RegExp][] = [
  ["mosques", /\b(mosque|masjid|musalla|jamia|jaame?|islamic centre|islamic center|muslim association)\b/i],
  ["churches", /\b(church|chapel|cathedral|parish|congregation of christ|evangel|baptist|pentecostal|anglican|catholic|presbyterian|lutheran|methodist|orthodox church|assembly of god|tabernacle)\b/i],
  ["gurdwaras", /\b(gurdwara|gurudwara|sikh|khalsa)\b/i],
  ["hindu-temples", /\b(hindu|mandir|devi|shiva|krishna|ganesh|swaminarayan|durga|balaji|iskcon)\b/i],
  ["buddhist-temples", /\b(buddh|vihara|dharma|zen centre|zen center|meditation temple|sangha)\b/i],
  ["synagogues", /\b(synagogue|shul|chabad|beth |bnai|b'nai|jewish congregation|hebrew congregation)\b/i],
];

/**
 * Reads a subcategory from a business's own name.
 *
 * 21,230 of 55,000 businesses arrived with no subcategory — 53% of all
 * restaurants — because the sources do not record one. Toronto licenses an
 * "EATING OR DRINKING ESTABLISHMENT" without saying whether it is a pizzeria
 * or a bakery, and NAICS 722511 is simply "Full-Service Restaurants". Those
 * businesses are correctly filed under Restaurants but invisible to anyone
 * filtering to Pizza, which is how people actually search a directory.
 *
 * Names are the one place the information reliably exists: "Gino's Pizza",
 * "Ace Hair Salon", "Northern Glow Nail". Same discipline as
 * religionSubcategory — EXACTLY one marker must match, or this returns null
 * and the row keeps no subcategory. A wrong subcategory is worse than none:
 * it puts a business in front of people looking for something else, and the
 * owner cannot see or correct it.
 *
 * Every slug produced here is validated against the live taxonomy by the
 * caller's test, so a typo cannot silently create a subcategory that no
 * filter will ever match.
 */
export const NAME_MARKERS: Record<string, [string, RegExp][]> = {
  restaurants: [
    ["pizza", /\b(pizza|pizzeria|pizzaiolo)\b/i],
    ["bakeries", /\b(bakery|bakeries|patisserie|p[âa]tisserie|boulangerie)\b/i],
    ["coffee-tea", /\b(coffee|caf[eé]|espresso|bubble tea|tea house|teahouse)\b/i],
    ["halal", /\bhalal\b/i],
    ["dessert", /\b(ice cream|gelato|dessert|donut|doughnut|cupcake|creamery|frozen yogurt)\b/i],
    ["grocery", /\b(grocery|groceries|supermarket|super ?market|convenience|food ?mart|butcher|fish market|meat market|fruit market)\b/i],
  ],
  beauty: [
    ["barbers", /\b(barber|barbers|barbershop)\b/i],
    ["hair-salons", /\b(hair|hairstyl\w*|coiffure)\b/i],
    ["nail-salons", /\b(nail|nails|manicure|pedicure)\b/i],
    ["spas", /\bspa\b/i],
    ["massage", /\bmassage\b/i],
    // "ink" is deliberately absent — it reads as a tattoo marker but appears
    // in plenty of unrelated trading names.
    ["tattoo-piercing", /\b(tattoo|piercing)\b/i],
  ],
  health: [
    ["dentists", /\b(dental|dentist|dentistry|orthodont\w*|denture\w*)\b/i],
    ["pharmacies", /\b(pharmacy|pharmacies|drug ?mart|apothecary)\b/i],
    ["optometrists", /\b(optical|optometr\w*|eye ?care)\b/i],
    ["physiotherapy", /\b(physio|physiotherapy)\b/i],
    ["chiropractors", /\bchiropract\w*/i],
  ],
  professional: [
    ["lawyers", /\b(law|lawyers?|barrister\w*|solicitor\w*|paralegal|llp)\b/i],
    ["accountants", /\b(accounting|accountants?|cpa|bookkeep\w*)\b/i],
    ["real-estate-agents", /\b(realty|real ?estate|realtors?)\b/i],
    ["insurance", /\binsurance\b/i],
    ["mortgage-brokers", /\bmortgages?\b/i],
    ["marketing", /\b(marketing|advertising)\b/i],
  ],
  "home-services": [
    ["plumbers", /\b(plumbing|plumbers?)\b/i],
    ["electricians", /\b(electric|electrical|electrician\w*)\b/i],
    ["hvac", /\b(hvac|heating|air ?conditioning|furnace)\b/i],
    // "cleaners" is deliberately NOT here — in Toronto usage "Ace Cleaners"
    // is a dry cleaner, not a house-cleaning firm. It belongs to the slug
    // below, and mixing them mislabelled 445 of 687 rows.
    ["cleaning", /\b(cleaning|janitorial|maid|housekeeping)\b/i],
    ["dry-cleaning", /\b(dry ?clean\w*|laundr\w*|launderette|coin ?wash|cleaners|alterations?)\b/i],
    ["landscaping", /\b(landscap\w*|lawn ?care|gardening)\b/i],
    ["painters", /\b(painting|painters?)\b/i],
    ["roofing", /\b(roofing|roofers?)\b/i],
    ["movers", /\b(moving|movers)\b/i],
  ],
  education: [
    ["daycares", /\b(day ?care|child ?care|nursery|montessori|early learning)\b/i],
    ["driving-schools", /\b(driving school|driving academy)\b/i],
    ["music-lessons", /\b(music|piano|guitar|violin|conservatory)\b/i],
    ["tutoring-centres", /\b(tutor\w*|learning cent(re|er))\b/i],
  ],
  shopping: [
    ["clothing", /\b(clothing|apparel|boutique|fashions?)\b/i],
    ["jewellery", /\b(jewell?ery|jewell?ers?)\b/i],
    ["florists", /\b(florists?|flowers?)\b/i],
    ["furniture-stores", /\bfurniture\b/i],
    ["electronics-stores", /\belectronics\b/i],
  ],
};

/**
 * Matches that look right but are not.
 *
 * "Sunshine Dry Cleaning" contains the word "cleaning", so it matches the
 * house-cleaning marker as well as the dry-cleaning one and would resolve to
 * nothing under the exactly-one rule. Vetoing the weaker reading lets the
 * specific one win, rather than losing both.
 */
const NAME_VETOES: Record<string, [string, RegExp][]> = {
  "home-services": [["cleaning", /\b(dry ?clean\w*|laundr\w*|launderette|coin ?wash|alterations?)\b/i]],
};

export function subcategoryFromName(category: string, name: string): string | null {
  const markers = NAME_MARKERS[category];
  if (!markers) return null;
  const vetoes = NAME_VETOES[category] ?? [];
  const hits = markers
    .filter(([, re]) => re.test(name))
    .map(([slug]) => slug)
    .filter((slug) => !vetoes.some(([vetoed, re]) => vetoed === slug && re.test(name)));
  // Exactly one. "Pizza Nova Cafe" matches both pizza and coffee-tea and so
  // gets neither — the strictness is the point.
  return hits.length === 1 ? hits[0] : null;
}

export function religionSubcategory(name: string): string | null {
  const hits = RELIGION_MARKERS.filter(([, re]) => re.test(name)).map(([slug]) => slug);
  // Exactly one faith must match. A name hitting two markers ("Hindu Temple
  // and Church Hall") is ambiguous and gets none.
  return hits.length === 1 ? hits[0] : null;
}

/**
 * A usable street address starts with a street number and has some substance.
 * Guards against blank/placeholder rows. Callers that pull from a
 * Toronto-only dataset can rely on this alone; callers reading a licensing
 * feed that covers out-of-city licensees must ALSO check the city field.
 *
 * An optional leading unit token is allowed, because Brampton's directory
 * writes the unit INTO the address as a prefix — "8-8550 TORBRAM RD",
 * "134A-499 MAIN ST S", "A-149 CLARENCE ST" — rather than in a separate
 * field the way Mississauga, York and Durham do. The original pattern
 * required a digit run followed immediately by whitespace, so every one of
 * those was rejected as junk: 2,353 of Brampton's 6,126 records, 38% of the
 * city, and disproportionately the plaza and mall units where a great many
 * of Brampton's independent shops actually trade. Found while investigating
 * a user report that a real Brampton grocery store returned no results.
 */
export function isPlausibleStreetAddress(line: string | null | undefined): boolean {
  if (!line) return false;
  const l = line.trim();
  if (l.length < 5) return false;
  // The optional single leading letter covers rural Ontario numbering —
  // "B1420 Thorah Concession Rd 4", "B295 48 Highway", "B27305 Sideroad 17"
  // are real addresses in Brock Township, and requiring a leading digit threw
  // away 47 genuine Durham businesses (Beaverton Self Storage, Fairgreen Sod
  // Farms) as malformed. One letter only: it must still be a number-led
  // address, not a name-led line like "Unit 4, Some Plaza".
  return /^(?:[A-Za-z0-9]+\s*-\s*)?[A-Za-z]?\d+[a-zA-Z0-9]*\s+\S/.test(l);
}
