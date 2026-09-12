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

    // Widened Sep 2026, alongside the cuisines below.
    ["coffee-tea", /\b(coffee ?house|coffeehouse|roaster\w*|tea ?room|milk ?tea|boba)\b/i],
    ["dessert", /\b(sweets?|chocolat\w*|waffle|crepe|bingsu|churro)\b/i],
    ["grocery", /\b(market|deli|delicatessen)\b/i],
    // "shawarma" is deliberately NOT here. It is a Middle Eastern dish before
    // it is a format, and listing it in both places would make every shawarma
    // shop ambiguous between two true readings and so resolve to neither.
    ["fast-food", /\b(take ?out|takeaway|drive[- ]?thru|burgers?|wings?|fries|sandwich(es)?|sub ?shop|hot ?dogs?|fried chicken|poutine)\b/i],
    // "fine-dining" gets no marker at all, on purpose: it is a claim about
    // quality and price, and no word in a trading name is evidence for it.
    // "Steakhouse" reads upmarket and is just as often a strip-mall grill.

    // Chains. A chain's name IS its identity, so these are the highest-
    // confidence rule in the table — anchored to the start so "Subway" the
    // restaurant matches and "Subway Sandwich Repair Co" does not become one
    // by accident. Chains carry many locations each, which is why 1,355 rows
    // turn on this block alone.
    ["fast-food", /^(subway|a&w|mcdonald'?s|burger king|wendy'?s|harvey'?s|kfc|popeyes|mary brown'?s|taco bell|five guys|new york fries|osmow'?s|basil box|freshii|extreme pita|mucho burrito|quesada|chipotle|wing ?stop|dave'?s hot chicken|churchs? chicken)\b/i],
    ["coffee-tea", /^(tim hortons?|starbucks|second cup|country style|coffee ?culture|aroma espresso|chatime|coco fresh|gong ?cha|the alley|presse caf|good earth coffee)/i],
    ["pizza", /^(pizza ?pizza|pizza ?nova|domino'?s|papa ?john'?s|little caesars|2 for 1 pizza|gino'?s pizza|panago|pizzaville)/i],
    ["dessert", /^(baskin[- ]robbins|dairy queen|menchie'?s|marble slab|cows ice cream|demetres|krispy kreme|cinnabon)/i],
    ["grocery", /^(loblaws|no frills|food basics|freshco|metro|sobeys|longo'?s|farm ?boy|shoppers drug mart|walmart|costco|fortinos|zehrs|real canadian superstore)\b/i],

    // Cuisines. Each marker is a word that names an origin or a dish that
    // belongs to exactly one of them — "pho" and "banh mi" are Vietnamese
    // wherever they appear, in a way that "grill" or "kitchen" is nothing.
    ["african", /\b(african|ethiopian|eritrean|somali|nigerian|injera|habesha)\b/i],
    // "West Indian" is the Caribbean, not India — see the veto below, which
    // stops the "indian" marker claiming these.
    ["caribbean", /\b(caribbean|west indian|jamaican|jerk|trinidad\w*|roti shop|doubles)\b/i],
    ["chinese", /\b(chinese|szechuan|sichuan|cantonese|dim ?sum|hot ?pot|wonton|congee|noodle house)\b/i],
    ["filipino", /\b(filipino|pinoy|lechon)\b/i],
    ["greek", /\b(greek|souvlaki|gyro|taverna)\b/i],
    ["indian", /\b(indian|biryani|tandoor\w*|curry house|masala|punjabi|dosa|chaat|samosa|roti)\b/i],
    ["italian", /\b(italian|trattoria|ristorante|osteria|pasta)\b/i],
    ["japanese", /\b(japanese|sushi|ramen|izakaya|teriyaki|sashimi|udon|bento)\b/i],
    ["korean", /\b(korean|bibimbap|bulgogi|kimchi)\b/i],
    ["mexican", /\b(mexican|taqueria|tacos?|burrito|cantina|quesadilla)\b/i],
    ["middle-eastern", /\b(middle ?eastern|lebanese|shawarma|shawerma|falafel|kebab|kabob|persian|iranian|turkish|syrian)\b/i],
    ["portuguese", /\b(portuguese|churrasqueira|piri ?piri|peri ?peri)\b/i],
    ["thai", /\bthai\b/i],
    ["vietnamese", /\b(vietnamese|pho|banh ?mi|bun ?bo)\b/i],
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
  // "Good Vibes West Indian Restaurant" is Caribbean food. The word "Indian"
  // is right there, so the indian marker fires and — both being cuisines in
  // one tier — the row would either resolve to India or, once "west indian"
  // was added to caribbean, to nothing at all. Suppressing the weaker reading
  // lets the specific one win, exactly as with dry cleaners above.
  //
  // "East Indian", which in Canadian usage does mean India, is untouched.
  restaurants: [["indian", /\bwest indian\b/i]],
};

/**
 * Precedence, for categories where two markers can BOTH be right.
 *
 * The plain one-match-or-nothing rule assumes competing markers are competing
 * claims, so disagreement means doubt. Cuisines broke that assumption: a
 * Portuguese bakery really is Portuguese and really is a bakery, and a halal
 * Indian restaurant really is both. Only one field holds the answer, so
 * refusing to choose would throw away thousands of rows that are not ambiguous
 * at all — merely doubly true.
 *
 * Tiers are tried in order; the first tier holding exactly one surviving match
 * wins. A tier holding two IS genuine ambiguity and stops the search — "Pizza
 * Nova Cafe" is a pizzeria or a café and nothing decides which, so it keeps
 * getting nothing.
 *
 * The order encodes which answer serves a searcher best:
 *   halal   — scarce, high-intent, and the reason someone is filtering at all.
 *             Someone avoiding non-halal food needs this more than they need
 *             to be told the kitchen is Indian; the cuisine is still findable
 *             by name search, which reads the name directly.
 *   form    — what the business IS. A Portuguese bakery is somewhere you buy
 *             bread; the origin describes the bread.
 *   cuisine — the origin, once form has nothing to say.
 *   fast-food — last, because it is the vaguest: "Indian Take Out" is far more
 *             useful filed under Indian than under a format shared with every
 *             burger counter in the GTA.
 */
export const SLUG_TIERS: Record<string, string[][]> = {
  restaurants: [
    ["halal"],
    ["pizza", "bakeries", "coffee-tea", "dessert", "grocery"],
    [
      "african", "caribbean", "chinese", "filipino", "greek", "indian",
      "italian", "japanese", "korean", "mexican", "middle-eastern",
      "portuguese", "thai", "vietnamese",
    ],
    ["fast-food"],
  ],
};

export function subcategoryFromName(category: string, name: string): string | null {
  const markers = NAME_MARKERS[category];
  if (!markers) return null;
  const vetoes = NAME_VETOES[category] ?? [];
  // Distinct slugs: several markers may emit the same one — the chain rule and
  // the generic rule both say "pizza" for Pizza Nova — and two rules agreeing
  // is the opposite of ambiguity. Counting them twice used to read as a
  // conflict and discard the row.
  const hits = [
    ...new Set(markers.filter(([, re]) => re.test(name)).map(([slug]) => slug)),
  ].filter((slug) => !vetoes.some(([vetoed, re]) => vetoed === slug && re.test(name)));

  const tiers = SLUG_TIERS[category];
  if (!tiers) {
    // Exactly one. "Pizza Nova Cafe" matches both pizza and coffee-tea and so
    // gets neither — the strictness is the point.
    return hits.length === 1 ? hits[0] : null;
  }
  for (const tier of tiers) {
    const inTier = hits.filter((h) => tier.includes(h));
    if (inTier.length === 1) return inTier[0];
    if (inTier.length > 1) return null;
  }
  return null;
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
