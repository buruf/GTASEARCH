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

export function cleanName(operatingName: string): string {
  return titleCase(stripCorporateSuffix(operatingName));
}

export function cleanAddress(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

/**
 * A usable street address starts with a street number and has some substance.
 * Guards against blank/placeholder rows. Callers that pull from a
 * Toronto-only dataset can rely on this alone; callers reading a licensing
 * feed that covers out-of-city licensees must ALSO check the city field.
 */
export function isPlausibleStreetAddress(line: string | null | undefined): boolean {
  if (!line) return false;
  const l = line.trim();
  if (l.length < 5) return false;
  return /^\d+[a-zA-Z0-9]*\s+\S/.test(l);
}
