# GTASearch — Phase 1: Public Marketplace

**Date:** 2026-07-28
**Status:** Approved
**Scope:** Phase 1 of 3. Read-only public marketplace.

---

## 1. Context and phasing

GTASearch.com is a mobile-first classifieds platform for the Greater Toronto Area — a
faster, cleaner alternative to Kijiji, restricted to the GTA and its surrounding cities.

The full product spans roughly six independent subsystems. Building them under a single
spec would produce requirements too vague to implement well, so the work is split into
three phases. Each phase gets its own spec, plan, and build cycle.

| Phase | Contents | Rationale |
|---|---|---|
| **1 — Public marketplace** | Schema + seed, homepage, search + filters, listing detail, sitemap, robots | Read-only, no auth, pure server rendering. Ships as a genuinely browsable site. |
| **2 — Accounts & posting** | NextAuth, post-ad wizard, Cloudinary upload, dashboard, edit/delete | Everything gated behind a user identity. |
| **3 — Money & engagement** | Stripe boosts, webhook, expiry cron, messaging, Resend email, favourites, reporting | Depends on both prior phases. |

**This document specifies Phase 1 only.**

### Out of scope for Phase 1

Authentication, posting or editing ads, image upload, Stripe, messaging, email,
favourites, the report-ad flow, and the boost-expiry cron. Phase 1 renders seeded data
only. The database models supporting later phases are created now (see §3) so that no
later phase requires a destructive migration, but no Phase 1 code reads or writes them.

---

## 2. Technology decisions

- **Next.js 14 App Router**, TypeScript in `strict` mode, Tailwind CSS.
- **PostgreSQL on Supabase**, accessed through Prisma. Migrations run against the direct
  connection (port 5432); the application uses the pooled connection (port 6543).
- **`pg_trgm` extension required.**
- No external search service. No client-side data fetching library.

### Rendering model

Every Phase 1 page is a React Server Component that queries Prisma directly. There are no
API routes for page data, no client-side fetching, and no loading states.

This is a deliberate choice rather than a stylistic one: the requirement that the homepage
and listing pages work without JavaScript, and the Lighthouse targets (90+ mobile
performance, 100 accessibility), are satisfied by construction under this model instead of
being retrofitted onto a client-rendered app.

The single exception is the view counter (§7), which is the only API route in Phase 1.

---

## 3. Data model

The schema is the user's original design with a set of corrections agreed during design
review. Field names and semantics from the original are preserved wherever they were
sound.

### Corrections applied to the supplied schema

1. **`Message` could not support an inbox.** As supplied it had `senderId` and `listingId`
   but no recipient and no thread, making two different buyers messaging the same seller
   indistinguishable. Added `recipientId` and a `Conversation` model that owns the
   messages and is unique per `(listingId, buyerId)`.
2. **`Listing.expiresAt` was missing.** The product requires 30-day auto-expiry and a
   reminder email three days before expiry, but nothing stored the expiry instant. Deriving
   it from `createdAt` at every call site breaks as soon as a listing is relisted. Added as
   a stored column.
3. **No `Report` model**, though "Report this ad" is a required flow. Added.
4. **`BoostPayment` had no relations**, making "what has this user paid for" unanswerable.
   Added relations to `Listing` and `User`.
5. **No indexes were declared**, including the `(category, city, status, createdAt)` index
   the product spec itself calls for. Added, along with the search indexes in §4.
6. **`SavedListing` lacked cascade deletes.** Added `onDelete: Cascade` so deleting a
   listing or user does not orphan rows.

### Models

`User`, `Listing`, `Conversation`, `Message`, `SavedListing`, `BoostPayment`, `Report`.

Phase 1 reads only `User` and `Listing`. All models are created in the initial migration.

### Listing fields of note

- `price Decimal?` — nullable, since `priceType` may be `free`, `contact`, or `trade`.
- `priceType String` — `"fixed" | "free" | "contact" | "trade"`.
- `images String[]` — Postgres native array of image URLs.
- `status String @default("active")` — `"active" | "sold" | "expired" | "deleted"`.
- `boostLevel String @default("none")` — `"none" | "top" | "featured" | "super"`.
- `boostExpiresAt DateTime?`
- `expiresAt DateTime` — set to `createdAt + 30 days` on creation.
- `postalCode String?` — **never returned to the client under any circumstance.** Enforced
  by explicit `select` clauses on every listing query; `SELECT *` is prohibited for
  listings.

### Indexes

- `@@index([category, city, status, createdAt])` — primary filtered-browse path.
- `@@index([status, expiresAt])` — visibility filtering and the future expiry cron.
- `@@index([userId])`
- GIN indexes on the search columns, declared in raw SQL (§4).

---

## 4. Search

### Terminology correction

The original brief described "Postgres full-text search using `pg_trgm` for fuzzy
matching". These are two distinct mechanisms solving different problems:

- **`tsvector`** provides full-text search: stemming, stop words, and relevance ranking.
  It matches "chairs" against "chair" and can order results by how well they match.
- **`pg_trgm`** provides trigram similarity: tolerance of misspellings. It matches "sofsa"
  against "sofa". It does not stem and ranks poorly.

Phase 1 implements both, in a hybrid arrangement.

### Implementation

A generated column `searchVector tsvector` is built from `title` (weight A) and
`description` (weight B), with a GIN index over it. A second GIN index using
`gin_trgm_ops` covers `title`.

Prisma cannot express either the `tsvector` type or these index types, so both are created
in a hand-written migration, together with `CREATE EXTENSION IF NOT EXISTS pg_trgm`.

`lib/search.ts` exposes a single function that accepts parsed filters and returns
`{ rows, total }`. It executes the `tsvector` query first. If that returns fewer than five
rows, it re-runs using trigram matching against `title`. Filters, sort order, and
pagination are identical on both paths, so the fallback is invisible to the caller.

#### Trigram operator and threshold (measured, not assumed)

The fallback must use **`word_similarity()` / the `<%` operator**, not `similarity()` /
`%`. `similarity()` compares whole strings, so a short query scored against a long title
is diluted below any usable threshold. Measured against representative seed titles:

| Query | Intent | `similarity()` | `word_similarity()` |
|---|---|---|---|
| `sofa` | exact word | 0.179 | 1.000 |
| `sofsa` | transposition | 0.097 | 0.500 |
| `dreser` | dropped letter | 0.194 | 0.667 |
| `iphonne` | doubled letter | 0.194 | 0.667 |
| `honda civc` | dropped letter, two words | 0.290 | 0.818 |
| `couch` | synonym — must NOT match | 0.029 | 0.167 |

Under `similarity()` every true match falls below the 0.3 default threshold, and
`honda civc` (0.290) outranks an exact `sofa` match (0.179) purely because its title is
shorter. That approach cannot work.

`word_similarity()` separates true matches (0.500–1.000) from the true negative (0.167)
cleanly, but its default threshold of **0.6 is too strict** — it would reject the `sofsa`
transposition at 0.500. Phase 1 therefore sets
`pg_trgm.word_similarity_threshold = 0.45`, which sits inside the empty band between
0.167 and 0.500. The setting is applied with `SET LOCAL` inside the same transaction as
the fallback query, so it never leaks into other connections in the pool.

Raw SQL is confined to `lib/search.ts`. Every other query in the codebase uses the Prisma
query builder.

### Sort order

Results are ordered by *effective* boost level, then by recency:

```sql
ORDER BY CASE
  WHEN "boostExpiresAt" IS NULL OR "boostExpiresAt" <= now() THEN 3
  WHEN "boostLevel" = 'super'    THEN 0
  WHEN "boostLevel" = 'featured' THEN 1
  WHEN "boostLevel" = 'top'      THEN 2
  ELSE 3
END, "createdAt" DESC
```

The `boostExpiresAt` check is load-bearing. Boost downgrades are performed by a nightly
cron in Phase 3, so between a boost expiring and the cron running, a listing retains a
stale `boostLevel`. Ordering on the stored value alone would keep expired boosts at the top
of results for up to 24 hours.

### Visibility

Every public query filters `status = 'active' AND expiresAt > now()`. This is applied in a
single shared helper so no call site can forget it.

---

## 5. Pages

### `/` — Homepage

Sticky header: green GTASearch wordmark, city selector, search bar, prominent "Post Ad"
CTA, Sign In / Register links. In Phase 1 the auth links and Post Ad button route to
Phase 2 placeholder pages.

Hero with a large search bar (keyword + category + city). Tagline: "Buy, sell, and find
anything in the Greater Toronto Area."

Category grid — 12 categories with icons, three columns on mobile, six on desktop.

Featured listings section: `super`-boosted active listings, newest first. Below it, recent
listings, newest first.

Footer: About, Contact, Terms, Privacy, Post Ad, Popular Searches.

### `/search` — Results

Reads `?q=&category=&city=&minPrice=&maxPrice=&type=&posted=&sort=&page=`.

Filter panel on the left on desktop; on mobile a `<details>` disclosure drawer. Filters:
category, city (multi-select), price range, listing type, date posted, sort.

Results header states the count in context: `247 results for "sofa" in Toronto`. Results
render as a card grid — thumbnail, title, price, city, relative time, and a Featured badge
where boosted. 24 results per page, with pagination as plain links.

### `/listing/[id]` — Detail

Image gallery (up to 10 photos), title, price, city and neighbourhood, posted date,
Featured badge, full description.

Seller card: display name, member since, count of active ads. **Star rating is deferred to
a later phase** — no ratings data exists and the model has no field for it; showing a
fabricated rating would be misleading.

Contact buttons, Save to Favourites, and Report render as visibly disabled controls
carrying a "Coming soon" tooltip — present so the layout is final, but unmistakably
inactive rather than appearing broken. Share buttons (WhatsApp, Copy Link,
X) work in Phase 1, as they need no backend. Safety tips render as a `<details>`
accordion. Similar listings: same category and city, excluding the current listing.

`generateMetadata` emits Open Graph title, description, price, and first image for social
previews.

### `/sitemap.xml` and `/robots.txt`

Next's native `sitemap.ts` and `robots.ts` conventions. The sitemap is generated from
active, unexpired listings plus static routes.

---

## 6. Behaviour without JavaScript

The homepage and listing pages are SEO-critical and must render fully server-side. Beyond
that baseline:

- The filter panel is a `<form method="GET" action="/search">` with a submit button.
  Filtering therefore works with JavaScript disabled. A later enhancement can auto-submit
  on change without restructuring anything.
- The mobile filter drawer and the safety-tips accordion use `<details>`/`<summary>`, so
  they open and close with no JavaScript.
- The image gallery renders as a CSS scroll-snap strip, which swipes natively on touch
  devices. The desktop lightbox is a progressive enhancement layered on top.
- Pagination is ordinary anchor links.

The view counter is the only JavaScript-dependent feature, and its absence is harmless.

---

## 7. View counter

A small client component issues one `POST /api/listings/[id]/view` per listing per session.
A session cookie records which listings have already been counted, preventing rapid-refresh
inflation. Owner-view exclusion requires an authenticated session and is therefore deferred
to Phase 2; the API route is written so that adding the check later is a two-line change.

---

## 8. Error handling and hostile input

Search URLs are user-editable and shareable, so `/search` must never return a 500.

- Unknown `category` or `city` slugs are dropped from the filter set rather than throwing.
- Non-numeric, negative, or inverted price bounds are discarded.
- `page` is coerced to an integer and clamped to the valid range.
- `sort` falls back to the default when unrecognised.
- Listings that are missing, deleted, expired, or non-active resolve to `notFound()`.
- Empty result sets render a real empty state with suggested alternatives, not a blank grid.

---

## 9. Testing

- **Vitest over `lib/`:** filter-parameter parsing including hostile input, effective-boost
  ordering, CAD currency formatting, and relative-time formatting.
- **One integration test** against the seeded Supabase database asserting that (a) a
  boosted listing sorts above a newer unboosted one, (b) a listing with an *expired* boost
  does not, and (c) a misspelled query still returns results via the trigram fallback.
- **Browser verification** of every page using the preview tooling, at mobile and desktop
  widths, with screenshots supplied to the user.

---

## 10. Seed data

`prisma/seed.ts` generates:

- 5 users.
- 50 listings spread across all 12 categories and the 15 GTA cities, with realistic
  GTA-flavoured titles, descriptions, and CAD prices.
- Images from `picsum.photos`, registered under `next.config` `remotePatterns` so
  `next/image` will serve them.
- A deliberate mix of `none`, `top`, `featured`, and `super` boosts, **including at least
  one listing whose boost has already expired**, so the effective-boost ordering rule in §4
  is exercised by real data rather than only by tests.
- A range of `priceType` values so free, contact, and trade rendering paths are all visible.

The seed is idempotent: re-running it resets to a known state rather than duplicating rows.

---

## 11. Design system

- Primary `#2E7D32`, accent `#66BB6A`, backgrounds `#FFFFFF` / `#F5F5F5`, text `#212121` /
  `#616161`.
- Inter, self-hosted via `next/font` — avoids a render-blocking request to Google and
  protects the performance target.
- 8px radius on cards, 6px on buttons.
- Mobile-first throughout; every page is designed at 375px before desktop.
- All currency is CAD, formatted with `Intl.NumberFormat('en-CA')`.

---

## 12. Environment variables

Phase 1 requires only:

```
DATABASE_URL=        # Supabase pooled connection, port 6543
DIRECT_URL=          # Supabase direct connection, port 5432 — migrations only
```

The remaining variables from the product brief (NextAuth, Google OAuth, Cloudinary, Stripe,
Resend, admin email) belong to Phases 2 and 3. `.env.example` documents the full set with
the Phase 1 subset marked as currently required.

---

## 13. Definition of done

- `npx prisma migrate dev` and `npx prisma db seed` both succeed against Supabase.
- Homepage, search, and listing detail all render seeded data server-side.
- Search returns sensibly ranked results; a misspelling still returns results.
- Boosted listings sort above unboosted; expired boosts do not.
- All three pages render correctly with JavaScript disabled.
- `postalCode` appears nowhere in any served payload.
- `/sitemap.xml` and `/robots.txt` respond correctly.
- Vitest suite passes.
- Lighthouse on mobile: 90+ performance, 100 accessibility.
