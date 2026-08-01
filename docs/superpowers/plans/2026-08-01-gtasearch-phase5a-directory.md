# GTASearch Phase 5A — Directory Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live `/directory` — taxonomy, searchable Business data with the same full-text treatment as listings, SEO browse pages, business profiles, and a capped Toronto open-data import.

**Architecture:** `Business` mirrors `Listing`'s proven patterns: hand-edited migration for the generated tsvector + GIN/trigram indexes, raw SQL confined to `lib/business.ts` exactly as `lib/search.ts` does for listings, server-component pages, taxonomy as a typed const. Import pipeline is an idempotent upsert-by-slug script with a committed licence→taxonomy mapping.

**Tech Stack:** Next.js 14 App Router, Prisma 6, Vitest. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-01-gtasearch-phase5a-directory-design.md`. All prior invariants binding; classifieds code/data untouched.
- Seed integrity: every Business row is a real business; factual public info only; neutral templated descriptions; NO fabricated reviews/ratings anywhere.
- Live production DB: create-only migrations (`npm run db:migrate` → hand-edit → `npm run db:deploy`); strip Prisma drift DROPs for ALL hand-written indexes (Listing's search indexes AND partial uniques — recurs every migration); never db:seed/reset; integration tests self-provision `vitest-*` fixtures (Business fixtures: slug prefix `vitest-biz-`) and clean up in afterAll.
- Unknown category/city slugs on browse routes → 404, never empty pages.
- `/directory/search` noindex; hub, category, category×city (with ≥1 business), and `/biz/[slug]` pages indexable and in the sitemap.
- Import cap this phase: 1,000 rows; only unambiguous licence categories; skipped rows counted, never guessed.
- Windows; commands from `C:\Users\buruf\Documents\gtasearch`; don't start/stop dev servers or run `npm run build` (controller owns both); commit per task, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Existing interfaces: `db`, `CITIES`/`getCity`/`getCityLabel` (lib/cities), `Prisma.sql` raw patterns + `WORD_SIMILARITY_THRESHOLD 0.45` + `FALLBACK_THRESHOLD 5` rationale (lib/search.ts — READ IT before Task 3), `CategoryIcon` map (components/CategoryIcon.tsx), design tokens, `formatRelativeTime`.

---

### Task 1: Business taxonomy + slug helper

**Files:**
- Create: `lib/business-categories.ts`
- Create: `lib/business-slug.ts`
- Create: `lib/business-taxonomy.test.ts`

**Interfaces:**
- Produces: `BUSINESS_CATEGORIES: BusinessCategory[]` where `BusinessCategory = { slug: string; label: string; icon: string; subcategories: { slug: string; label: string }[] }`; `getBusinessCategory(slug?)`, `getBusinessCategoryLabel(slug)`, `getBusinessSubcategoryLabel(cat, sub)` — same degrade contract as lib/categories; `makeBusinessSlug(name: string, citySlug: string): string` (pure; no collision handling — callers append `-2`… as needed) and `slugifyName(name: string): string`.

- [ ] **Step 1: Write failing tests**

`lib/business-taxonomy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BUSINESS_CATEGORIES, getBusinessCategory, getBusinessCategoryLabel, getBusinessSubcategoryLabel } from "@/lib/business-categories";
import { makeBusinessSlug } from "@/lib/business-slug";
import { getCity } from "@/lib/cities";

describe("business taxonomy", () => {
  it("has the ten spec categories with unique slugs", () => {
    expect(BUSINESS_CATEGORIES).toHaveLength(10);
    const slugs = BUSINESS_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(10);
    expect(slugs).toContain("restaurants");
    expect(slugs).toContain("home-services");
  });
  it("every category has subcategories with unique slugs", () => {
    for (const c of BUSINESS_CATEGORIES) {
      expect(c.subcategories.length).toBeGreaterThanOrEqual(4);
      const s = c.subcategories.map((x) => x.slug);
      expect(new Set(s).size).toBe(s.length);
    }
  });
  it("lookup helpers degrade instead of throwing", () => {
    expect(getBusinessCategory("nope")).toBeUndefined();
    expect(getBusinessCategoryLabel("nope")).toBe("nope");
    expect(getBusinessSubcategoryLabel("health", "nope")).toBe("nope");
    expect(getBusinessCategory("health")?.label).toBe("Health & Medical");
  });
});

describe("makeBusinessSlug", () => {
  it("kebabs name and appends city", () => {
    expect(makeBusinessSlug("Mamma's Pizza & Grill", "toronto")).toBe("mammas-pizza-grill-toronto");
  });
  it("handles unicode and squeezes punctuation runs", () => {
    expect(makeBusinessSlug("Café  Crème!!!", "vaughan")).toBe("cafe-creme-vaughan");
  });
  it("caps the name part at 60 chars", () => {
    const s = makeBusinessSlug("x".repeat(100), "ajax");
    expect(s.length).toBeLessThanOrEqual(60 + 1 + "ajax".length);
  });
  it("city slugs used are real", () => {
    expect(getCity("toronto")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/business-taxonomy.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/business-categories.ts`** — same file shape as `lib/categories.ts` (typed const + Map-backed helpers). The exact taxonomy:

```ts
export interface BusinessSubcategory { slug: string; label: string }
export interface BusinessCategory { slug: string; label: string; icon: string; subcategories: BusinessSubcategory[] }

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { slug: "restaurants", label: "Restaurants & Food", icon: "utensils", subcategories: [
    { slug: "pizza", label: "Pizza" }, { slug: "coffee-tea", label: "Coffee & Tea" },
    { slug: "bakeries", label: "Bakeries" }, { slug: "halal", label: "Halal" },
    { slug: "fast-food", label: "Fast Food" }, { slug: "fine-dining", label: "Fine Dining" },
    { slug: "grocery", label: "Grocery" }, { slug: "dessert", label: "Dessert" } ] },
  { slug: "health", label: "Health & Medical", icon: "cross", subcategories: [
    { slug: "dentists", label: "Dentists" }, { slug: "family-doctors", label: "Family Doctors" },
    { slug: "walk-in-clinics", label: "Walk-in Clinics" }, { slug: "pharmacies", label: "Pharmacies" },
    { slug: "optometrists", label: "Optometrists" }, { slug: "physiotherapy", label: "Physiotherapy" },
    { slug: "chiropractors", label: "Chiropractors" } ] },
  { slug: "home-services", label: "Home Services", icon: "wrench", subcategories: [
    { slug: "plumbers", label: "Plumbers" }, { slug: "electricians", label: "Electricians" },
    { slug: "hvac", label: "HVAC" }, { slug: "cleaning", label: "Cleaning" },
    { slug: "landscaping", label: "Landscaping" }, { slug: "painters", label: "Painters" },
    { slug: "roofing", label: "Roofing" }, { slug: "movers", label: "Movers" },
    { slug: "handyman", label: "Handyman" } ] },
  { slug: "beauty", label: "Beauty & Wellness", icon: "scissors", subcategories: [
    { slug: "hair-salons", label: "Hair Salons" }, { slug: "barbers", label: "Barbers" },
    { slug: "nail-salons", label: "Nail Salons" }, { slug: "spas", label: "Spas" },
    { slug: "massage", label: "Massage" } ] },
  { slug: "automotive", label: "Automotive", icon: "car", subcategories: [
    { slug: "auto-repair", label: "Auto Repair" }, { slug: "oil-change", label: "Oil Change" },
    { slug: "tires", label: "Tires" }, { slug: "car-wash", label: "Car Wash" },
    { slug: "detailing", label: "Detailing" }, { slug: "body-shops", label: "Body Shops" } ] },
  { slug: "professional", label: "Professional Services", icon: "briefcase", subcategories: [
    { slug: "lawyers", label: "Lawyers" }, { slug: "accountants", label: "Accountants" },
    { slug: "real-estate-agents", label: "Real Estate Agents" }, { slug: "insurance", label: "Insurance" },
    { slug: "mortgage-brokers", label: "Mortgage Brokers" }, { slug: "marketing", label: "Marketing" } ] },
  { slug: "shopping", label: "Shopping & Retail", icon: "bag", subcategories: [
    { slug: "clothing", label: "Clothing" }, { slug: "electronics-stores", label: "Electronics" },
    { slug: "furniture-stores", label: "Furniture" }, { slug: "jewellery", label: "Jewellery" },
    { slug: "florists", label: "Florists" } ] },
  { slug: "education", label: "Education & Childcare", icon: "book", subcategories: [
    { slug: "daycares", label: "Daycares" }, { slug: "tutoring-centres", label: "Tutoring Centres" },
    { slug: "driving-schools", label: "Driving Schools" }, { slug: "music-lessons", label: "Music Lessons" } ] },
  { slug: "fitness", label: "Fitness & Recreation", icon: "dumbbell", subcategories: [
    { slug: "gyms", label: "Gyms" }, { slug: "yoga-pilates", label: "Yoga & Pilates" },
    { slug: "martial-arts", label: "Martial Arts" }, { slug: "swimming", label: "Swimming" },
    { slug: "sports-clubs", label: "Sports Clubs" } ] },
  { slug: "pets", label: "Pets", icon: "paw", subcategories: [
    { slug: "veterinarians", label: "Veterinarians" }, { slug: "grooming", label: "Grooming" },
    { slug: "pet-stores", label: "Pet Stores" }, { slug: "boarding-daycare", label: "Boarding & Daycare" } ] },
];

const BY_SLUG = new Map(BUSINESS_CATEGORIES.map((c) => [c.slug, c]));
export function getBusinessCategory(slug: string | undefined): BusinessCategory | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}
export function getBusinessCategoryLabel(slug: string): string {
  return BY_SLUG.get(slug)?.label ?? slug;
}
export function getBusinessSubcategoryLabel(categorySlug: string, subcategorySlug: string | null): string | null {
  if (!subcategorySlug) return null;
  return BY_SLUG.get(categorySlug)?.subcategories.find((s) => s.slug === subcategorySlug)?.label ?? subcategorySlug;
}
```

- [ ] **Step 4: Implement `lib/business-slug.ts`**

```ts
// SEO slugs for business profiles: kebab name + city, ASCII-folded.
// Collision suffixes (-2, -3…) are the importer's job — this stays pure.

export function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // fold accents: Café → Cafe
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function makeBusinessSlug(name: string, citySlug: string): string {
  return `${slugifyName(name)}-${citySlug}`;
}
```

- [ ] **Step 5: Run to verify pass** — `npx vitest run lib/business-taxonomy.test.ts` → PASS (7 tests). Then full suite.

- [ ] **Step 6: Commit** — `git add lib/business-categories.ts lib/business-slug.ts lib/business-taxonomy.test.ts` / message `Add business taxonomy and slug helpers`.

---

### Task 2: Business migration

**Files:**
- Modify: `prisma/schema.prisma` (append the spec §2 model verbatim, with the same comment style as Listing's searchVector)
- Create: `prisma/migrations/<ts>_phase5a_business/migration.sql` (generated, hand-edited)

**Interfaces:**
- Produces: Prisma `Business` model exactly as spec §2 (fields, defaults, `@@unique(slug)` via `slug String @unique`, `@@index([category, city, status])`, `@@index([city, status])`, `searchVector Unsupported("tsvector")?`).

- [ ] **Step 1:** Append the spec §2 model to `prisma/schema.prisma` (copy the block verbatim; keep the Unsupported comment noting the hand-edited generated column).
- [ ] **Step 2:** `npm run db:migrate -- --name phase5a_business` (create-only). Inspect the SQL: DELETE any drift statements touching `Listing_searchVector_idx`, `Listing_title_trgm_idx`, `Listing_one_draft_per_user`, `Report_one_per_reporter`, or Listing's searchVector column (this drift recurs — see ledger).
- [ ] **Step 3:** Hand-edit the generated SQL: replace the plain `"searchVector" tsvector` column line in CREATE TABLE with the generated version, and append the indexes — exactly this shape:

```sql
    "searchVector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("description", '')), 'B')
    ) STORED,
```

and after the CreateIndex block:

```sql
-- Hand-written search indexes (Prisma cannot express either type).
CREATE INDEX "Business_searchVector_idx" ON "Business" USING GIN ("searchVector");
CREATE INDEX "Business_name_trgm_idx" ON "Business" USING GIN ("name" gin_trgm_ops);
```

- [ ] **Step 4:** `npm run db:deploy` then `npx prisma generate` (controller has stopped the dev server; if EPERM on the engine DLL, report BLOCKED).
- [ ] **Step 5:** Verify live: `npx tsx -e` snippet creating one Business row (slug `vitest-biz-migration-check-toronto`), reading it back via `$queryRaw` selecting `searchVector IS NOT NULL`, then deleting it. Expected: vector非null.
- [ ] **Step 6:** Full `npx vitest run` (nothing regresses). Commit `prisma` — `Add Business model with generated search vector`.

---

### Task 3: `lib/business.ts` — search, browse, profile, counts

**Files:**
- Create: `lib/business.ts`
- Create: `lib/business.integration.test.ts`

**Interfaces:**
- Consumes: `db`, `getBusinessCategory`, `getCity`. READ `lib/search.ts` FIRST — this module mirrors its structure (raw SQL confined, degrade-don't-throw, trigram transaction pattern) and MUST reuse its exact thresholds.
- Produces:
  - `BUSINESS_PAGE_SIZE = 24`
  - `interface BusinessRow { id: string; slug: string; name: string; description: string; category: string; subcategory: string | null; city: string; neighbourhood: string | null; address: string; phone: string | null; website: string | null; images: string[]; verified: boolean }`
  - `parseBusinessSearchParams(params): { q: string; category?: string; city?: string; page: number }` (degrade contract: unknown slugs dropped, page clamped, q trimmed ≤100)
  - `searchBusinesses(f): Promise<{ rows: BusinessRow[]; total: number; usedFallback: boolean }>` — tsvector primary (`plainto_tsquery`, rank ordered with `verified DESC` leading, then rank, then name), trigram fallback vs `name` when total < 5 (same `set_config('pg_trgm.word_similarity_threshold','0.45',true)` transaction pattern), filters `status='active'` + optional category/city.
  - `getBusiness(slug): Promise<(BusinessRow & { hours: string | null; createdAt: Date }) | null>` (active only, Prisma query builder — no raw SQL needed)
  - `browseBusinesses(category, city | undefined, page): Promise<{ rows: BusinessRow[]; total: number }>` — alphabetical by name, `verified DESC` first (query builder).
  - `businessCountsByCategory(): Promise<Record<string, number>>`
  - `businessCityCounts(category): Promise<Record<string, number>>`
  - `similarBusinesses(slug, category, city, limit = 4): Promise<BusinessRow[]>`

- [ ] **Step 1: Write failing integration tests** — fixture pattern: beforeAll creates ~8 businesses under slugs prefixed `vitest-biz-${STAMP}-` (two categories, two cities, one verified, names including "Lakeshore Dental Centre" for trigram target "Lakeshore Dentl"), afterAll `db.business.deleteMany({ where: { slug: { startsWith: \`vitest-biz-${STAMP}-\` } } })` + `$disconnect`. Tests:

```ts
// (imports + fixture setup per above; STAMP = Date.now())
describe("business search", () => {
  it("finds by name word, verified first on ties", async () => {
    const { rows } = await searchBusinesses(parseBusinessSearchParams({ q: "dental" }));
    expect(rows.some((r) => r.name.includes("Lakeshore Dental"))).toBe(true);
    const verifiedIdx = rows.findIndex((r) => r.verified);
    if (verifiedIdx > 0) {
      expect(rows.slice(0, verifiedIdx).every((r) => r.verified)).toBe(true);
    }
  });
  it("recovers a typo through the trigram fallback", async () => {
    const { rows, usedFallback } = await searchBusinesses(parseBusinessSearchParams({ q: "Dentl" }));
    expect(usedFallback).toBe(true);
    expect(rows.some((r) => r.name.includes("Dental"))).toBe(true);
  });
  it("filters by category and city, degrades unknown slugs", async () => {
    const f = parseBusinessSearchParams({ q: "", category: "health", city: "toronto" });
    const { rows } = await searchBusinesses(f);
    expect(rows.every((r) => r.category === "health" && r.city === "toronto")).toBe(true);
    const g = parseBusinessSearchParams({ category: "not-real", city: "gotham" });
    expect(g.category).toBeUndefined();
    expect(g.city).toBeUndefined();
  });
});
describe("browse, profile, counts, similar", () => {
  it("browse is alphabetical within verified-first and paginates", async () => { /* fetch page1, assert names sorted (verified block then rest), total >= fixtures in that category */ });
  it("getBusiness returns active by slug, null for hidden/unknown", async () => { /* flip one fixture to status hidden, expect null, flip back */ });
  it("counts move with fixtures", async () => { /* businessCountsByCategory()[cat] >= n; businessCityCounts(cat).toronto >= n */ });
  it("similar excludes self and matches category+city", async () => { /* similarBusinesses on a fixture */ });
});
```

(Write the bodies fully in the actual file — assertions exactly as sketched, no empty tests.)

- [ ] **Step 2:** Run → FAIL. 
- [ ] **Step 3:** Implement `lib/business.ts` mirroring `lib/search.ts`: same header comment style ("raw SQL confined here"), `const VISIBLE_BIZ = Prisma.sql\`"status" = 'active'\``, SELECT column list WITHOUT hours/timestamps for rows (BusinessRow shape), search ORDER BY `"verified" DESC, ${rank} DESC, "name" ASC` (and trigram path `"verified" DESC, ${wsim} DESC, "name" ASC`), count queries, fallback comparison `trgmTotal > total` identical to listings. `parseBusinessSearchParams` validates against `getBusinessCategory`/`getCity`. Non-search reads via the Prisma query builder.
- [ ] **Step 4:** Run integration file → PASS (7 tests). `npx tsc --noEmit`. Full suite.
- [ ] **Step 5:** Commit — `Add business search and browse library`.

---

### Task 4: Profile page + directory hub + icons

**Files:**
- Modify: `components/CategoryIcon.tsx` (add icon paths for keys: `utensils`, `cross`, `wrench`, `scissors`, `bag`, `book`, `dumbbell` — simple 1.6-stroke outline paths consistent with existing ones; `car`, `briefcase`, `paw` already exist)
- Create: `components/BusinessCard.tsx`
- Create: `app/directory/page.tsx`
- Create: `app/biz/[slug]/page.tsx`

**Interfaces:**
- Consumes: Task 3 library, taxonomy, `getCityLabel`, `CategoryIcon`.
- Produces: `BusinessCard({ business }: { business: BusinessRow })` — used by hub, browse, search, similar strips: image-or-initial tile, name (+ verified check glyph when `verified`), category·subcategory line, address line, phone as `tel:` link; whole card links to `/biz/[slug]` with the phone link a sibling overlay (the SaveHeart lesson: interactive elements never nest inside the card anchor).

- [ ] **Step 1:** Add the seven icon paths (outline style matching existing: stroke currentColor, strokeWidth 1.6). Keep each ≤4 elements.
- [ ] **Step 2:** `components/BusinessCard.tsx` per the interface above (server component; `next/image` for the photo when present, else a brand-50 tile with the business's first letter).
- [ ] **Step 3:** `app/directory/page.tsx`: metadata title "GTA Business Directory"; hero band (reuse the homepage's sky-gradient + `TorontoSkyline` component at reduced height) with H1 "Find local businesses across the GTA", GET search form (`action="/directory/search"`, inputs `q` + category select from BUSINESS_CATEGORIES + city select from CITIES); popular chips linking browse pages: Dentists→`/directory/health/toronto`? NO — chips link category pages: `/directory/health`, `/directory/home-services`, `/directory/restaurants`, `/directory/beauty`, `/directory/automotive`, `/directory/professional` with labels "Dentists, Plumbers, Pizza, Hair Salons, Auto Repair, Real Estate" respectively... **Resolution of ambiguity: chips deep-link to the SUBcategory's parent category page with `?sub=` param? Keep simple: chips link `/directory/[category]` pages with the chip label = the marquee subcategory label.** Category grid with counts (`businessCountsByCategory`), same visual pattern as homepage CategoryGrid; "Recently added" strip of 8 newest active businesses (query builder, newest first) using BusinessCard.
- [ ] **Step 4:** `app/biz/[slug]/page.tsx`: `getBusiness` or `notFound()`; breadcrumb Home / Directory / {Category} / {City}; header block (name + verified badge, category·subcategory, address, phone `tel:`, website link `rel="nofollow noopener" target=_blank`, hours line when present, Google Maps LINK `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + address)}`); photos strip if any (scroll-snap like listings); description paragraph; "Is this your business?" card — copy: "Claiming and updating your listing is coming soon. Meanwhile, corrections: our contact page." linking /contact; `similarBusinesses` strip via BusinessCard; `generateMetadata` with OG title `${name} — ${categoryLabel} in ${cityLabel}` and description from the description field.
- [ ] **Step 5:** `npx tsc --noEmit`; full suite. Commit — `Add directory hub and business profile pages`.

---

### Task 5: Browse pages, search page, nav, sitemap

**Files:**
- Create: `app/directory/[category]/page.tsx`
- Create: `app/directory/[category]/[city]/page.tsx`
- Create: `app/directory/search/page.tsx`
- Modify: `components/Header.tsx` (a "Directory" nav link before Post Ad, visible both breakpoints), `components/Footer.tsx` (Directory column: top 6 category links)
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: Tasks 1/3/4 exports.

- [ ] **Step 1:** `[category]/page.tsx`: `getBusinessCategory(params.category)` or `notFound()`; H1 `${label} in the GTA`; subcategory chips (links to `?sub=` filtered view of the same page — filter applied in `browseBusinesses` call... **keep scope: chips render as spans this phase? NO —** implement `?sub=` filtering via a `subcategory` arg added to `browseBusinesses` (include in Task 3's signature: `browseBusinesses(category, city, page, subcategory?)`); city link cloud with counts (`businessCityCounts`), hiding zero-count cities; first 24 businesses + pagination (plain links, `?page=`). Indexable.
- [ ] **Step 2:** `[category]/[city]/page.tsx`: both slugs validated or 404; H1 exactly `${categoryLabel} in ${cityLabel}` ("Plumbers in Brampton" shape comes from subcategory pages? — the spec's example is honest at category level: "Home Services in Brampton"; with `?sub=plumbers` the H1 becomes `${subLabel} in ${cityLabel}`); businesses via `browseBusinesses(category, city, page, sub)`, pagination; cross-links: same category other cities (count>0), other categories same city; `generateMetadata` title `${h1} | GTASearch Directory`, description "Find ${h1.toLowerCase()} — addresses, phone numbers and websites on GTASearch."
- [ ] **Step 3:** `search/page.tsx`: noindex; parse via `parseBusinessSearchParams`; results header "N businesses for 'q'"; filter panel (category, city selects — GET form); BusinessCard grid + pagination; trigram-fallback notice reusing the classifieds copy pattern ("showing closely matching names").
- [ ] **Step 4:** Header: add `<Link href="/directory">Directory</Link>` styled like Sign In (text link) in desktop row AND a compact link in the mobile search row; Footer: new "Directory" column (first 6 BUSINESS_CATEGORIES linking their category pages). 
- [ ] **Step 5:** Sitemap: append `/directory`; every `/directory/[category]`; every `/directory/[category]/[city]` where count ≥1 (use `businessCityCounts` per category); every active business `/biz/[slug]` (query builder, select slug+updatedAt). Keep listings entries untouched.
- [ ] **Step 6:** `npx tsc --noEmit`; full suite. Commit — `Add directory browse and search pages, nav and sitemap entries`.

---

### Task 6: Toronto open-data import pipeline

**Files:**
- Create: `scripts/import-toronto-businesses.ts`
- Create: `scripts/toronto-licence-mapping.ts`
- Create: `lib/import-mapping.test.ts`

**Interfaces:**
- Consumes: `db`, `makeBusinessSlug`, taxonomy.
- Produces: a runnable `npx tsx scripts/import-toronto-businesses.ts [--dry-run] [--limit N]`.

- [ ] **Step 1 (exploration):** Fetch the City of Toronto CKAN API (`https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=municipal-licensing-and-standards-business-licences-and-permits` — if the package id differs, search via `package_search?q=business+licences`) and inspect the active resource's fields (expect columns like Category, Operating Name, Licence Address …). Record the ACTUAL field names in the script's header comment.
- [ ] **Step 2:** `scripts/toronto-licence-mapping.ts` — committed mapping table `LICENCE_MAPPING: Record<string, { category: string; subcategory?: string }>` covering ONLY unambiguous licence classes, e.g. `"EATING ESTABLISHMENT" → restaurants`, `"BARBER SHOP"/"HAIRDRESSING" → beauty/barbers|hair-salons`, `"PUBLIC GARAGE"/"AUTO SERVICE" → automotive/auto-repair`, `"VETERINARY" → pets/veterinarians`, `"DRIVING SCHOOL" → education/driving-schools` — adjust keys to the REAL values found in Step 1; anything not in the table is skipped.
- [ ] **Step 3:** `lib/import-mapping.test.ts` — every mapping value's category resolves via `getBusinessCategory`, every subcategory exists in it (loop assertion), table is non-empty.
- [ ] **Step 4:** The import script: stream/paginate the resource via CKAN `datastore_search` (limit batches of 1000), for each mapped+licensed-active row: clean name (title-case, trim corporate suffixes like "LTD"/"INC" for display), require a plausible street address, build slug via `makeBusinessSlug` with `-2` suffixing on collision (check both in-batch and DB), templated description `"${SubcategoryLabel ?? CategoryLabel} in Toronto."` + `" Licensed with the City of Toronto."`, `city: "toronto"`, `source: "open-data"`, upsert by slug; counters: imported/updated/skipped-unmapped/skipped-bad-address; `--dry-run` prints the licence-category histogram and mapping coverage without writing; hard cap `--limit` default 1000 (Global Constraint).
- [ ] **Step 5:** Run `--dry-run` first (report the histogram in the task report), then the real run capped at 1000. Report exact counters. Spot-check 3 imported rows by querying and eyeballing name/address plausibility (include them in the report).
- [ ] **Step 6:** Full suite (business integration tests must still pass with real data present — they are fixture-scoped). Commit scripts + test — `Add Toronto open-data business import (capped first batch)`.

NOTE: if the CKAN dataset proves unusable (dead endpoint, no address field, licence classes too opaque), STOP and report BLOCKED with what was found — do not substitute scraping or a different source; the controller escalates to the user.

---

### Task 7: Final verification, docs, deploy (controller-run)

- [ ] Full suite; tsc; prod build (dev server stopped); browser pass: hub (counts real from import), a category page, "Home Services in Toronto" browse, a business profile (maps link, tel link), search with a typo, 404s for `/directory/fake` and `/biz/fake`; mobile + desktop; Lighthouse on `/directory` and one browse page (90+/100 targets); README Phase 5A section; ledger; final whole-branch review (most capable model) + fix wave; merge; deploy; live verification incl. sitemap size; memory update; report to user with seeded counts and the homepage-flip checkpoint question.

---

## Self-review notes

- Spec §2→T2, §3→T1, §4→T3 (with `subcategory` arg added to browse per T5 Step 1 — note the signature in T3 must include it: `browseBusinesses(category, city, page, subcategory?)`), §5→T4/T5, §6→T6, §7 tests→per task + T7. Ambiguity resolved in T4 Step 3: popular chips link category pages (subcategory deep-filter via `?sub=`).
- Type consistency: `BusinessRow` defined T3, consumed T4/T5; `browseBusinesses` 4-arg signature stated in both T3 and T5; icon keys in T1 taxonomy match the seven added in T4 plus three existing.
- Import integrity rules restated where they bite (T6 steps 2/4: only mapped classes, counters, no guessing).
