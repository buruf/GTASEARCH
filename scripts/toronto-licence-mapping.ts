// Maps City of Toronto business-licence "Category" values (from the
// Municipal Licensing and Standards open-data feed — see
// scripts/import-toronto-businesses.ts header for the dataset and field
// details) to our BUSINESS_CATEGORIES taxonomy (lib/business-categories.ts).
//
// Every key here is a REAL "Category" value confirmed present in the live
// dataset (checked against a full scan of all 159,459 rows, 92 distinct
// categories, on 2026-08-01). Only classes whose real-world meaning is
// unambiguous are included — see the notes below for what was deliberately
// left out and why. Anything not in this table is skipped by the importer
// and counted as skipped-unmapped; nothing is guessed.
//
// Notably absent from the real data (so not mappable, contrary to the task
// brief's illustrative examples):
//   - No "BARBER SHOP" / "HAIRDRESSING" categories exist. Toronto licenses
//     all of hairdressing, barbering, manicure/pedicure, tanning, tattooing
//     etc. under one umbrella, "PERSONAL SERVICES SETTINGS" (11,029 rows),
//     with no field that discloses which specific service a given licence
//     covers. That class is intentionally left unmapped — mapping it to
//     beauty/hair-salons or beauty/barbers would be a guess.
//   - No "VETERINARY" category exists. Ontario vets are licensed by the
//     College of Veterinarians of Ontario, not the City, so this dataset
//     has no veterinary rows. "PET SHOP" is the only pets-taxonomy match.
//   - No electrician/landscaper/painter/roofer/mover categories exist
//     either — those trades are licensed elsewhere (e.g. ESA for
//     electrical). home-services below only covers the trades this
//     specific dataset actually licenses.
//
// Deliberately excluded despite being common/large categories:
//   - PERSONAL SERVICES SETTINGS, HOLISTIC CENTRE — ambiguous (see above).
//   - TAXICAB/LIMOUSINE/PEDICAB/PRIVATE TRANSPORTATION owner/operator/broker
//     classes, and mobile-vending/hawker classes — these are typically
//     individual plate/permit holders licensed at a home address, not
//     storefront businesses with a public street address.
//   - ADULT ENTERTAINMENT CLUB, BODY RUB PARLOUR, BATH HOUSE — excluded
//     regardless of taxonomy fit.
//   - PAWN SHOP, PRECIOUS METAL SHOP, VAPOUR PRODUCT RETAILER, SMOKE SHOP —
//     no unambiguous, clean fit in the taxonomy's "shopping" subcategories,
//     or (precious metal / pawn) genuinely ambiguous as to whether they're
//     retail vs. pure resale/pawn operations.
//   - Every individual trade/contractor licence class this dataset covers —
//     MASTER PLUMBER, PLUMBING CONTRACTOR, PLUMBING & HEATING CONTRACTOR,
//     DRAIN LAYER, DRAIN CONTRACTOR, MASTER HEATING INSTALLER, HEATING
//     CONTRACTOR, BUILDING RENOVATOR, BUILDING CLEANER, INSULATION
//     INSTALLER, DRIVEWAY PAVING CONTRACTOR, CHIMNEY REPAIRMAN, and
//     DRIVING SCHOOL OPERATOR (V) (the individual-instructor variant, as
//     opposed to (B), the business-operator variant which IS mapped below).
//     These were tried and then pulled after inspecting real "Licence
//     Address" values for each: a large share are null, and of the rest a
//     large share are plainly residential (subdivision crescents/courts,
//     spread across Bolton/Newmarket/Ajax/Caledon/Thornhill/Cookstown/
//     Oshawa/etc. — i.e. wherever the individual tradesperson happens to
//     live, not a Toronto place of business). Toronto licenses these as
//     personal trade qualifications/sole-proprietor contractor licences,
//     not storefront businesses, so there is no reliable way to import them
//     without a real risk of publishing someone's home address in a public
//     business directory. Excluded entirely rather than guessing row by row
//     which addresses are "probably commercial."

export interface LicenceMappingEntry {
  category: string;
  subcategory?: string;
}

export const LICENCE_MAPPING: Record<string, LicenceMappingEntry> = {
  // ---- restaurants -------------------------------------------------
  "EATING OR DRINKING ESTABLISHMENT": { category: "restaurants" },
  "EXPANDED EATING/DRINKING ESTABLISHMENT": { category: "restaurants" },
  // Take-out/retail food licences are the class that covers fast-food-style
  // counter service (as opposed to sit-down eating/drinking establishments).
  "TAKE-OUT OR RETAIL FOOD ESTABLISHMENT": { category: "restaurants", subcategory: "fast-food" },

  // ---- automotive ----------------------------------------------------
  // "Public garage" is Toronto's licence class for auto-repair garages.
  "PUBLIC GARAGE": { category: "automotive", subcategory: "auto-repair" },
  "AUTO SERVICE STATION": { category: "automotive", subcategory: "auto-repair" },

  // ---- pets ------------------------------------------------------------
  "PET SHOP": { category: "pets", subcategory: "pet-stores" },

  // ---- education ---------------------------------------------------
  // "(B)" is the corporate/business driving-school operator licence — a
  // real school with premises. "(V)" (individual instructor/own vehicle)
  // is deliberately excluded; see the header note.
  "DRIVING SCHOOL OPERATOR (B)": { category: "education", subcategory: "driving-schools" },

  // ---- shopping --------------------------------------------------------
  // Resale of general used goods; no closer taxonomy subcategory exists.
  "SECOND HAND SHOP": { category: "shopping" },
};
