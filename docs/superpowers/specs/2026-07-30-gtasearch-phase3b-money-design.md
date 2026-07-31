# GTASearch — Phase 3B: Money (Stripe Boosts, Nightly Cron, Expiry Emails)

**Date:** 2026-07-30
**Status:** Approved
**Scope:** Second half of Phase 3, and the final phase of the original product
brief. Stripe-paid listing boosts, the nightly maintenance cron, and
expiry-reminder emails. Builds on Phases 1–3A; their invariants remain binding.

---

## 1. Decisions made during design review

1. **Publish first, then pay.** A paid boost choice never holds a listing
   hostage: the ad publishes free immediately, then the seller is handed to
   Stripe Checkout. Abandoning payment leaves the ad live and unboosted.
2. **Stripe is keys-later**, like every external service before it. Absent
   `STRIPE_SECRET_KEY`, boost cards render "Available soon" exactly as today
   and the dashboard Boost button does not render.
3. **Inline `price_data` instead of `STRIPE_PRICE_*` env vars.** Three fewer
   keys, no Stripe-dashboard product setup, identical checkout UX. The only
   Stripe env vars are `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
4. **Payment truth comes from the webhook**, never from the success redirect.

## 2. Migration (one, small)

- `Listing.expiryReminderAt DateTime?` — set when the expiry-reminder email
  is successfully sent; the cron never reminds twice for the same expiry
  cycle. Cleared on relist (a relisted ad starts a fresh cycle).
- Hand-written partial unique index (Prisma cannot express it):
  `CREATE UNIQUE INDEX "Report_one_per_reporter" ON "Report"("listingId", "reporterId") WHERE "reporterId" IS NOT NULL;`
  — closes the 3A-review race on signed-in report dedupe at the database.
  `createReport` catches the P2002 as `duplicate: true`.
- Workflow as always: `npm run db:migrate` (create-only) → hand-edit → 
  `npm run db:deploy`. Never `migrate dev`, never reset.

## 3. Boost tiers

| Tier | Price (CAD) | Duration | boostLevel |
|---|---|---|---|
| Top Ad | $4.99 | 7 days | `top` |
| Featured | $9.99 | 14 days | `featured` |
| Super Boost | $14.99 | 30 days | `super` |

Defined once in `lib/boost.ts` as `BOOST_TIERS` (label, blurb, cents,
days, level) — the single source for the wizard step, the boost page, the
checkout call, and the webhook. Also exported from `lib/boost.ts`:
`effectiveBoostOf(level: string, expiresAt: Date | null): 0|1|2|3` — the one
TypeScript implementation of the effective-boost rule, replacing the
duplicate in `lib/saved.ts` (the SQL CASE in `lib/search.ts` remains, with
cross-reference comments both ways).

## 4. Checkout flow

- **Entry points:**
  - Wizard boost step: the three paid cards become selectable when Stripe is
    configured. Choosing one publishes the ad (existing `publishDraft`), then
    redirects to Stripe Checkout for that tier. Free remains the default.
  - Dashboard: active listings gain a "Boost" action → `/listing/[id]/boost`
    — a tier picker page (also linked from the seller's own listing page).
    Owner-only (`ownedListing` guard); only `active`, unexpired listings.
- `lib/stripe.ts`: `stripeEnabled()`, and `createBoostCheckout(userId,
  listingId, tier): Promise<string>` returning the Checkout URL. Session:
  `mode: "payment"`, currency `cad`, inline `price_data` from `BOOST_TIERS`,
  `metadata: { listingId, userId, level, days }`,
  `success_url: /listing/[id]?boost=success`, `cancel_url: /listing/[id]/boost?cancelled=1`.
- Re-boosting an already-boosted listing is allowed (it's revenue): the new
  boost replaces level and expiry outright. The picker shows the current
  boost state so the seller knows what they're replacing.
- Rate limit: 10 checkout sessions/day/user (`boost:` key).

## 5. Webhook — `/api/stripe/webhook`

- Verifies the Stripe signature against `STRIPE_WEBHOOK_SECRET` using the
  raw request body; unverifiable requests get 400. The verifier is injected
  so tests can construct events.
- Handles `checkout.session.completed` only; other event types are 200-acked
  and ignored.
- On completion: create `BoostPayment` (`stripeId` = session id — the
  existing unique constraint makes webhook replays idempotent: a P2002 means
  already processed, ack 200 and stop), then set the listing's `boostLevel`
  and `boostExpiresAt = now + days` from session metadata, `status: "paid"`.
- Listing gone by webhook time (deleted mid-payment): record the
  `BoostPayment` row for the money trail, skip the listing update, ack 200.
  (Refund handling is out of scope; the payment record is the evidence.)
- The success redirect (`?boost=success`) renders a confirmation banner on
  the listing page reading "Boost payment received — your placement updates
  within a minute." It never writes anything: the webhook is the only writer.

## 6. Nightly cron

- `vercel.json`: one cron entry, daily (`0 6 * * *` UTC ≈ 1–2 am Toronto),
  hitting `/api/cron/nightly`.
- Auth: request must carry `Authorization: Bearer ${CRON_SECRET}` (Vercel
  sends it automatically once the env var exists). Missing/wrong secret →
  401. Missing CRON_SECRET env → endpoint refuses (fail closed, the eduyro
  lesson).
- Four jobs, sequential, each try/caught so one failure doesn't stop the
  rest, each reporting a count in the JSON response `{ expired, downgraded,
  draftsSwept, remindersSent }`:
  1. **Expire:** `status: "active", expiresAt < now` → `status: "expired"`.
  2. **Downgrade:** `boostLevel != "none", boostExpiresAt < now` →
     `boostLevel: "none", boostExpiresAt: null`. (Search already ignores
     lapsed boosts via effective-boost; this is bookkeeping.)
  3. **Draft sweep:** global delete of drafts older than 7 days (takes over
     the Phase 2 per-user sweep, which remains as belt-and-braces).
  4. **Expiry reminders:** `status: "active"`, expiring within 3 days,
     `expiryReminderAt: null` → email "Your ad expires in N days — relist
     free" with a dashboard link; set `expiryReminderAt` only on successful
     send (Resend-degraded: skip silently, leave unmarked so it sends when
     keys arrive). Cap 50 emails per run (Resend free tier is 100/day).
- Logic lives in `lib/cron.ts` as four exported functions returning counts —
  fully integration-testable without HTTP; the route is a thin auth wrapper.
- `relistListing` (lib/manage.ts) additionally clears `expiryReminderAt`.

## 7. Riding-along cleanups (from the 3A final review)

- `lib/saved.ts` uses `effectiveBoostOf` from `lib/boost.ts` (dup removed).
- Homepage `revalidate = 60` comment corrected (route has been dynamic since
  the Phase 2 session header; the export is inert — remove it and say why).

## 8. Environment variables

```
# Optional until keys arrive (degraded modes)
STRIPE_SECRET_KEY=       # sk_test_... first; boost UI hidden without it
STRIPE_WEBHOOK_SECRET=   # whsec_... from the Stripe webhook endpoint config
CRON_SECRET=             # any long random string; set in Vercel too
```

`.env.example` updated. `CRON_SECRET` should be set at deploy time (the cron
fails closed without it).

## 9. Security invariants

- Webhook: signature verification is mandatory; no signature bypass in
  production code paths. Idempotent via the `stripeId` unique.
- Checkout: owner-only, active-listing-only, rate-limited; tier comes from
  the server-side `BOOST_TIERS` table — the client sends a tier KEY, never a
  price.
- Cron: bearer-secret gated, fail-closed.
- No card data ever touches the app (Stripe Checkout hosted page) — the
  Privacy Policy already says exactly this.

## 10. Testing

- **Integration (fixtures, live DB, cleaned up):** each cron job — expiry
  flip, boost downgrade (and that search ordering was already correct
  pre-cron), draft sweep, reminder marking (with a fake sender injected;
  asserts no double-send and no marking on failed send); webhook handler
  with constructed events — happy path, replay (same stripeId twice → one
  BoostPayment), unknown event type, missing listing; relist clears
  `expiryReminderAt`.
- **Vitest (pure):** `BOOST_TIERS` shape, `effectiveBoostOf` against the SQL
  CASE's truth table, tier-key validation.
- **Degraded modes:** no Stripe keys → wizard cards inert + no dashboard
  button + checkout action errors cleanly; no CRON_SECRET → 401/refuse.
- **Browser:** wizard boost step and `/listing/[id]/boost` picker render
  (degraded until keys); full Stripe test-mode checkout E2E happens when the
  user's keys arrive.

## 11. Definition of done

- Migration applied; report dedupe enforced by the DB.
- Cron endpoint runs all four jobs with correct counts against fixtures and
  is scheduled in `vercel.json`; fails closed without its secret.
- Webhook verifies, applies boosts, and is replay-safe.
- Boost UI live-or-dormant per Stripe key presence; checkout redirects
  correctly with test keys.
- `effectiveBoost` exists in exactly one TypeScript place.
- Suite green; tsc clean; production build passes; browser verification at
  both widths; deployed to gtasearch.com.

## 12. Out of scope

Refunds/disputes handling, subscription or auto-renewing boosts, boost
performance analytics, invoices/receipts beyond Stripe's own emails, admin
console, currency other than CAD.
