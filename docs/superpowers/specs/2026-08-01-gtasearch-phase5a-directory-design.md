# GTASearch — Phase 5A: Directory Core

**Date:** 2026-08-01
**Status:** Approved
**Scope:** The pivot's foundation: a curated GTA business directory alongside
the existing classifieds. Schema, taxonomy, profile pages, category/city
browse pages, directory search, and the open-data import pipeline. Curated
hand-research seeding is a post-merge workstream; claiming/subscriptions
(5B), reviews (5C), deals/events (5D), and the homepage flip are later
phases. The homepage flip is a checkpoint decision the user makes after
seeing seeded data.

## 1. Decisions from design review

- Seed = municipal open data (breadth) + hand curation (quality). Every entry
  is a real business; only factual public info; neutral descriptions; zero
  fabricated reviews or ratings, ever. The Contact page is the removal path
  until 5B claiming exists.
- Build aside at `/directory`; current homepage untouched this phase. A
  "Directory" link is added to the site header and footer.
- Classifieds code, data and behaviour are untouched.

## 2. Data model (one migration)

```prisma
model Business {
  id            String   @id @default(cuid())
  slug          String   @unique          // kebab(name)-citySlug, collision-suffixed
  name          String
  description   String                    // neutral, factual
  category      String                    // BUSINESS_CATEGORIES slug
  subcategory   String?
  city          String                    // existing CITIES slug
  neighbourhood String?
  address       String
  phone         String?
  website       String?
  hours         String?                   // freeform display text, e.g. "Mon–Fri 9–6"
  images        String[]
  status        String   @default("active")   // "active" | "hidden"
  source        String                    // "open-data" | "curated" | "self"
  verified      Boolean  @default(false)  // 5B sets via claiming
  claimedById   String?                   // 5B
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  searchVector  Unsupported("tsvector")?  // generated: name A, description B — hand-edited migration like Listing
  @@index([category, city, status])
  @@index([city, status])
}
```

GIN indexes on `searchVector` and trigram on `name`, hand-written in the
migration exactly as Phase 1 did for Listing (strip any Prisma drift DROPs).

## 3. Business taxonomy (`lib/business-categories.ts`)

Ten categories; slugs are URL segments. Structure identical to
`lib/categories.ts` (typed const + lookup helpers) with an icon key each:

1. **restaurants** Restaurants & Food — pizza, coffee-tea, bakeries, halal,
   fast-food, fine-dining, grocery, dessert
2. **health** Health & Medical — dentists, family-doctors, walk-in-clinics,
   pharmacies, optometrists, physiotherapy, chiropractors
3. **home-services** Home Services — plumbers, electricians, hvac, cleaning,
   landscaping, painters, roofing, movers, handyman
4. **beauty** Beauty & Wellness — hair-salons, barbers, nail-salons, spas,
   massage
5. **automotive** Automotive — auto-repair, oil-change, tires, car-wash,
   detailing, body-shops
6. **professional** Professional Services — lawyers, accountants,
   real-estate-agents, insurance, mortgage-brokers, marketing
7. **shopping** Shopping & Retail — clothing, electronics-stores, furniture-stores,
   jewellery, florists
8. **education** Education & Childcare — daycares, tutoring-centres,
   driving-schools, music-lessons
9. **fitness** Fitness & Recreation — gyms, yoga-pilates, martial-arts,
   swimming, sports-clubs
10. **pets** Pets — veterinarians, grooming, pet-stores, boarding-daycare

Helpers: `getBusinessCategory(slug)`, `getBusinessCategoryLabel(slug)`,
`getBusinessSubcategoryLabel(cat, sub)` — same degrade-don't-throw contract
as the classifieds taxonomy.

## 4. Library (`lib/business.ts`)

Raw SQL confined here, mirroring `lib/search.ts` patterns:

- `searchBusinesses(filters)` — q + category + city (+subcategory), tsvector
  ranked with trigram fallback on `name` below 5 hits (same 0.45 threshold
  and transaction-scoped `set_config`), page size 24, effective ordering:
  `verified DESC, name ASC` within relevance ties. Never 500s on hostile
  params (same parse-and-degrade contract).
- `getBusiness(slug)` — active only; null → 404.
- `browseBusinesses(category, city?, subcategory?, page)` — the SEO pages'
  query, alphabetical, paginated.
- `businessCountsByCategory()` / `businessCountsForCategoryByCity(cat)` —
  hub grid + browse-page city links.
- `similarBusinesses(slug, category, city, limit 4)`.
- `makeBusinessSlug(name, citySlug)` pure helper: kebab, `-2`/`-3` collision
  suffixes applied by the import layer.

## 5. Pages

All server components, design system unchanged, all in the sitemap except
where noted.

- **`/directory`** — hub: headline "Find local businesses across the GTA",
  directory search form (GET → `/directory/search`), popular chips (Dentists,
  Plumbers, Pizza, Hair Salons, Auto Repair, Real Estate Agents — linking to
  their browse pages), category grid with live counts (reusing the CategoryGrid
  visual pattern with new icons), and a strip of newest verified/curated
  businesses.
- **`/directory/search`** — results page (`?q=&category=&city=`), noindex
  (same rationale as classifieds search), filter panel with the business
  taxonomy + cities.
- **`/directory/[category]`** — category landing: subcategory chips, city
  links with counts, first page of businesses. Indexable.
- **`/directory/[category]/[city]`** — "Plumbers in Brampton": H1 exactly
  that shape, business cards, pagination, links to the same category in other
  cities and other categories in the same city. Indexable — the SEO engine.
  Unknown category or city slugs → 404 (not empty pages: thin-content
  protection).
- **`/biz/[slug]`** — profile: name, category breadcrumb, address with a
  Google Maps *link* (no embed — Lighthouse), click-to-call phone, website
  link (`rel="nofollow"`), hours, photos (if any), neutral description,
  "Is this your business?" card (static teaser this phase: points to /contact,
  copy promises claiming "coming soon"), similar businesses. OG metadata.
  Indexable.
- **Header**: "Directory" link beside the existing nav (desktop + mobile);
  footer gains a Directory column (top categories). Homepage untouched.
- Sitemap: add `/directory`, every category page, every category×city page
  with ≥1 business, and every business profile.

## 6. Open-data import pipeline (`scripts/import-toronto-businesses.ts`)

- Source: City of Toronto Open Data (CKAN) — Municipal Licensing "Business
  licences" dataset (Open Government Licence – Toronto). The task explores the
  live dataset schema first; the mapping table (licence category → our
  taxonomy) is committed as code and only unambiguous licence classes are
  imported (e.g. eating establishments, barber shops/hairdressers, garages).
  Unmappable rows are skipped and counted, never guessed.
- Cleaning: title-case names, strip corporate suffixes for display (keep
  legal name in description), dedupe by (name, address), addresses formatted,
  `city: "toronto"` (dataset is Toronto-proper), `source: "open-data"`,
  neutral description templated from category + neighbourhood.
- Idempotent: re-runs upsert by slug; a `--limit` flag for test runs; dry-run
  mode printing the category histogram before writing.
- Run against production deliberately and reported with counts. Target: the
  import is capped this phase at 1,000 businesses across the mapped
  categories (quality floor beats raw volume; more batches later).
- Hand-curated entries are a post-merge workstream (research per business,
  `source: "curated"`), not part of this build's tasks.

## 7. Testing

- Unit: slug generation (collisions, punctuation, unicode), taxonomy helpers,
  licence-category mapping table (every mapped key resolves to a real
  taxonomy slug).
- Integration (live-DB fixture pattern): search ranked + trigram fallback on
  business names; browse pagination + alphabetical order; unknown slugs 404
  contract (null returns); counts; similar-businesses excludes self.
- Browser: hub, one browse page, one profile, search with typo — both
  widths; Lighthouse on `/directory` and one browse page (targets: 90+/100
  like the rest of the site).

## 8. Out of scope (later phases)

Claiming and subscriptions (5B), reviews (5C), deals/events (5D), homepage
flip (checkpoint), business self-registration, editing businesses in the
admin console (admin can hide via DB until 5B brings proper tooling),
map embeds, ongoing curation automation.
