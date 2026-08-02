// Maps Toronto Public Health inspection-program datasets to our
// BUSINESS_CATEGORIES taxonomy (lib/business-categories.ts). Used by
// scripts/import-toronto-health-services.ts — see that file's header for the
// dataset ids and field details.
//
// WHY THESE DATASETS EXIST IN OUR PIPELINE
// The Municipal Licensing business-licence feed (the Phase 5A source) lumps
// every hair, nail, tattoo, tanning and esthetics business into one opaque
// class, "PERSONAL SERVICES SETTINGS" (11,029 rows), with no field saying
// which service a given licence covers — so scripts/toronto-licence-mapping.ts
// deliberately left it unmapped rather than guess, and the beauty category
// shipped empty. Toronto Public Health's BodySafe feed covers the same
// premises but DOES disclose the service type per inspection (`srvType`),
// which is what makes an honest mapping possible.
//
// WHAT WE TAKE, AND WHAT WE DELIBERATELY DO NOT
// These are inspection datasets. We import ONLY the establishment's name,
// address and service type. Inspection outcomes — pass/fail status,
// infraction categories, deficiency descriptions, severity, fines — are
// never imported or displayed. GTASearch is a business directory, not an
// inspection-reporting service, and republishing enforcement history against
// a named local business is both outside our purpose and a fairness/accuracy
// hazard we are not equipped to maintain.

export interface HealthMappingEntry {
  category: string;
  /** Only set where the service type alone is unambiguous. */
  subcategory?: string;
}

/**
 * BodySafe `srvType` values. Every key is a real value confirmed present in
 * the live dataset (full scan of 13,194 rows / 3,692 distinct establishments
 * on 2026-08-02); the counts below are distinct establishments.
 *
 * All of them are beauty-category businesses. Subcategory is set only where
 * the service type pins it down on its own:
 *   - "Nails" (185) means a nail service — nail-salons.
 *   - The tattoo/piercing family (155 + 61 + 45 + 9) all land in the
 *     tattoo-piercing subcategory added for exactly this data.
 *   - "Barbering & Hairdressing" (1,486) covers BOTH barbershops and hair
 *     salons in one label, so it gets no subcategory here — refineSubcategory
 *     below splits it on name evidence, and falls back to hair-salons, the
 *     broader of the two.
 *   - "Aesthetics" (1,746) is the catch-all for facials/waxing/skin care and
 *     is genuinely ambiguous between spas, massage and plain esthetics, so it
 *     carries no subcategory unless the name says otherwise.
 *   - "Injectable Personal Services" (5) is medical-aesthetics; left without
 *     a subcategory rather than forced into spas.
 */
export const BODYSAFE_SERVICE_MAPPING: Record<string, HealthMappingEntry> = {
  Nails: { category: "beauty", subcategory: "nail-salons" },
  "Barbering & Hairdressing": { category: "beauty" },
  Aesthetics: { category: "beauty" },
  Tattooing: { category: "beauty", subcategory: "tattoo-piercing" },
  "Body Piercing": { category: "beauty", subcategory: "tattoo-piercing" },
  "Ear Piercing": { category: "beauty", subcategory: "tattoo-piercing" },
  "Micropigmentation/Microblading": { category: "beauty", subcategory: "tattoo-piercing" },
  "Injectable Personal Services": { category: "beauty" },
};

/**
 * ChildCareSafe covers licensed child care centres inspected by Toronto
 * Public Health for infection control. One establishment type, so one entry.
 */
export const CHILDCARE_MAPPING: HealthMappingEntry = {
  category: "education",
  subcategory: "daycares",
};

/** Ranks service types when an establishment is inspected under several
 *  (1,547 of 3,692 are). More specific wins: a premises inspected for both
 *  Nails and Aesthetics is a nail salon that also does facials, not the
 *  reverse. Lower number = higher priority. */
const SERVICE_PRIORITY: Record<string, number> = {
  Tattooing: 1,
  "Body Piercing": 2,
  "Micropigmentation/Microblading": 3,
  "Ear Piercing": 4,
  Nails: 5,
  "Barbering & Hairdressing": 6,
  "Injectable Personal Services": 7,
  Aesthetics: 8,
};

export function pickPrimaryServiceType(types: Iterable<string>): string | null {
  let best: string | null = null;
  let bestRank = Infinity;
  for (const t of types) {
    const rank = SERVICE_PRIORITY[t];
    if (rank === undefined) continue; // unknown/new service type — never guess
    if (rank < bestRank) {
      best = t;
      bestRank = rank;
    }
  }
  return best;
}

// Name evidence, checked before falling back to the service type. These fire
// only on explicit words in the business's own registered name, so they are
// read from the data rather than assumed. Order matters: most specific first.
// Hair/nail/tattoo words outrank "spa" and "massage" deliberately: plenty of
// salons trade as "<Something> Hair & Spa", and the leading trade is the one
// the business is actually known for. "Medical Spa" with no hair/nail word
// still lands on spas.
const NAME_RULES: { re: RegExp; subcategory: string }[] = [
  { re: /\bBARBER/i, subcategory: "barbers" },
  { re: /\b(TATTOO|PIERCING|MICROBLADING)\b/i, subcategory: "tattoo-piercing" },
  { re: /\b(NAILS?|MANICURE|PEDICURE)\b/i, subcategory: "nail-salons" },
  { re: /\b(HAIR|SALON|COIFFURE|STYLING)\b/i, subcategory: "hair-salons" },
  { re: /\bMASSAGE\b/i, subcategory: "massage" },
  { re: /\bSPA\b/i, subcategory: "spas" },
];

/**
 * Resolves the beauty subcategory for one establishment.
 *
 * Precedence: the business's own name first (strongest available signal —
 * "SCOOT INK TATTOO" is a tattoo studio no matter which inspection stream it
 * appears under), then the service type where that alone is decisive, then
 * the documented Barbering & Hairdressing fallback, then null. Returning null
 * is a real outcome, not a failure: the row still imports under the beauty
 * category and simply carries no subcategory chip.
 */
export function refineSubcategory(
  name: string,
  primaryServiceType: string | null,
): string | null {
  for (const rule of NAME_RULES) {
    if (rule.re.test(name)) return rule.subcategory;
  }

  const mapped = primaryServiceType ? BODYSAFE_SERVICE_MAPPING[primaryServiceType] : undefined;
  if (mapped?.subcategory) return mapped.subcategory;

  // "Barbering & Hairdressing" with a name that reveals nothing (e.g. "JUICE",
  // "MODE"): hair-salons is the broader of the two trades the label covers and
  // the safer landing spot — a barbershop filed under Hair Salons is still
  // findable and still true to the disclosed service; the reverse is not.
  if (primaryServiceType === "Barbering & Hairdressing") return "hair-salons";

  return null;
}
