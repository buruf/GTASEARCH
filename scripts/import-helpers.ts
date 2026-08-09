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
