# GTASearch — Phase 4: Admin Console

**Date:** 2026-07-31
**Status:** Approved
**Scope:** Owner-facing moderation console: overview stats, reports queue,
listing search & takedown. Explicitly independent of Resend — no email
anywhere in this phase. No database migration.

## 1. Who is admin

A signed-in user whose email equals the `ADMIN_EMAIL` environment variable
(case-insensitive trim). No role column, no role UI — one admin, env-driven,
zero migration. The day a second moderator exists is the trigger for a real
role model, not before.

Degraded mode (consistent with every other key): `ADMIN_EMAIL` unset →
`/admin` does not exist — every admin route returns 404 for everyone.

Access enforcement, defense in depth:
- Middleware matcher gains `/admin/:path*` + `/admin`: anonymous users bounce
  to sign-in with callbackUrl (existing pattern).
- `requireAdmin()` in `lib/admin.ts` runs on every admin page AND every admin
  action: loads the session, compares email to `adminEmail()` (the existing
  helper), and calls `notFound()` on mismatch — a signed-in non-admin sees a
  404, never a "forbidden" that confirms the route exists.

## 2. Pages

All under `/admin`, sharing a small tab layout (Overview · Reports ·
Listings), `robots: { index: false }`, styled with the existing design
system. Server components + server actions; no client state beyond forms.

### `/admin` — Overview

Count cards, one query each: total users; active listings; drafts; sold;
expired; open reports; boost revenue (sum of `BoostPayment.amount` where
status "paid", displayed CAD); unread-messages total across the site (an
activity pulse). Plus the 5 newest listings (any status) as quick links.

### `/admin/reports` — the queue

Open reports (`status: "open"`) grouped by listing: one card per reported
listing showing thumbnail, title (links to the public page), seller name and
email, listing status, and every open report against it (reason label,
details, reporter name-or-"Anonymous", age). Ordered by most-reported, then
newest.

Two actions per card, both server actions through `lib/admin.ts`:
- **Dismiss all** — every open report for that listing → `status:
  "dismissed"`. Listing untouched.
- **Remove listing** — listing soft-deleted (same `status: "deleted"` as the
  seller's own delete, recoverable in the DB), and every open report for it →
  `status: "actioned"`.

Empty state: "No open reports — nothing needs you."

Reports on already-deleted listings still appear (the report may be why it's
deleted); Remove on them just actions the reports.

### `/admin/listings` — search & takedown

Search box (title contains, case-insensitive, OR seller email contains; max
50 results, newest first, ALL statuses — this page exists to find things the
public search hides). Each row: thumbnail, title, status chip, seller email,
posted date, view count, links to public page + edit-in-DB reference (id
shown for Prisma Studio), and a **Remove** action (same soft-delete +
action-open-reports as above) with a confirm. Already-deleted rows show a
**Restore** action (status back to "active" with a fresh 30-day expiry) —
undo for moderation mistakes.

## 3. lib/admin.ts (all logic, thin actions on top)

- `requireAdmin(): Promise<string>` — admin userId or `notFound()`.
- `adminStats()` — the overview counts in one `Promise.all`.
- `openReportsByListing()` — grouped queue rows.
- `dismissReports(listingId)` / `removeListingWithReports(listingId)` /
  `restoreListing(listingId)` — the three mutations; every one re-checks
  admin inside the action wrapper (never trusts the page).
- `adminSearchListings(q)` — the listings search.

## 4. Testing

- Integration (fixtures, live-DB pattern): non-admin email → requireAdmin
  throws notFound; admin email (env set in test) passes; dismiss/remove/
  restore transitions including report statuses; removed listing invisible
  publicly, restored listing visible with ~30d expiry; stats counts move
  with fixtures; search finds by title and by seller email across statuses.
- Browser: full pass as admin (env set locally), plus signed-in non-admin
  gets 404 and anonymous gets signin bounce.

## 5. Out of scope

User bans/suspension, editing others' listings, refunds, emailing users,
audit logs, multi-admin roles, report pagination (revisit at >50 open).

## 6. Activation

Local test: `ADMIN_EMAIL` in `.env` (already in `.env.example`). Production:
user sets `ADMIN_EMAIL` in Vercel to their registered email + redeploy —
until then prod has no admin surface at all.
