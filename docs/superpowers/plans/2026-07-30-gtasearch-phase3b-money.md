# GTASearch Phase 3B — Money Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sellers can pay for listing boosts via Stripe Checkout (keys-later), a fail-closed nightly cron expires listings / downgrades lapsed boosts / sweeps drafts / sends expiry-reminder emails, and payment truth flows exclusively through a replay-safe webhook.

**Architecture:** All logic in `lib/` (`boost.ts` tiers + effective-boost helper, `stripe.ts` checkout, `webhook.ts` event application, `cron.ts` four jobs) with thin route/action wrappers, matching Phases 2–3A. Stripe signature verification is injected so tests construct events. One migration adds `Listing.expiryReminderAt` and a partial unique index closing the 3A report-dedupe race.

**Tech Stack:** Next.js 14 App Router, Prisma 6, `stripe` npm SDK (checkout + webhook verification), Vercel Cron, Resend (degraded), Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-gtasearch-phase3b-money-design.md`. All Phase 1–3A invariants remain binding.
- Live production DB: NEVER `db:seed`/`db:reset`/`prisma migrate dev`; migrations via `npm run db:migrate` (create-only) → hand-edit → `npm run db:deploy`. Integration tests self-provision `vitest-*@example.com` fixtures and clean up in afterAll.
- Degraded modes: no `STRIPE_SECRET_KEY` → boost cards stay "Available soon", dashboard/listing Boost entry points absent, checkout actions error cleanly. No `CRON_SECRET` → cron endpoint refuses (fail closed). No `RESEND_API_KEY` → reminders skipped silently AND left unmarked (`expiryReminderAt` stays null).
- Payment truth: only the webhook writes boost state. The `?boost=success` redirect renders a banner and writes nothing.
- Tier keys come from the server-side `BOOST_TIERS` table; the client submits a tier KEY, never a price.
- Tiers exactly: Top Ad $4.99 CAD/7d (`top`), Featured $9.99/14d (`featured`), Super Boost $14.99/30d (`super`).
- Rate limits via existing `rateLimit(key, limit, windowMs)`: checkout sessions 10/day/user (`boost:` key).
- Reminder email cap: 50 per cron run. Reminder window: `expiresAt` within 3 days of now.
- Do not run `npm run build` while the dev server runs; do not start/stop dev servers (controller owns them).
- Windows; commands from `C:\Users\buruf\Documents\gtasearch`. Commit per task, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Existing interfaces: `db` (lib/db), `requireUserId`/`currentUserId` (lib/auth), `rateLimit` (lib/rate-limit), `ownedListing`/`NotOwnerError`/`publishDraft`/`relistListing` (lib/manage), `FormState` (app/auth/actions), `resendEnabled`/`appUrl`/`adminEmail` (lib/env), Resend usage pattern in lib/email.ts, `getPublicListing` (lib/listing).

---

### Task 1: Migration — expiryReminderAt + report unique + relist/report wiring

**Files:**
- Modify: `prisma/schema.prisma` (Listing gains `expiryReminderAt DateTime?` after `expiresAt`; comment update)
- Create: `prisma/migrations/<timestamp>_phase3b_money/migration.sql` (generated, then hand-edited)
- Modify: `lib/reports.ts` (catch P2002 as duplicate)
- Modify: `lib/manage.ts` (relist clears `expiryReminderAt`)
- Modify: `lib/reports.integration.test.ts` (concurrent dedupe test)
- Modify: `lib/manage.integration.test.ts` (relist clears reminder test)

**Interfaces:**
- Produces: `Listing.expiryReminderAt: Date | null` on the Prisma client; DB-enforced signed-in report dedupe; `relistListing` additionally sets `expiryReminderAt: null`.

- [ ] **Step 1: Edit `prisma/schema.prisma`** — in `model Listing`, directly after the `expiresAt DateTime` line, add:

```prisma
  // Set when the "expiring soon" reminder email is sent; cleared on relist so
  // each 30-day cycle gets exactly one reminder. Written only by the cron.
  expiryReminderAt DateTime?
```

- [ ] **Step 2: Generate migration (create-only)**

```powershell
npm run db:migrate -- --name phase3b_money
```

Expected: new folder under `prisma/migrations/`, not applied. If Prisma emits DROP statements for the hand-written search indexes (`Listing_searchVector_idx`, `Listing_title_trgm_idx`) or the partial indexes (`Listing_one_draft_per_user`) as "drift", DELETE those DROP statements — this recurs every migration (see Phase 2 ledger) because those objects aren't representable in the schema.

- [ ] **Step 3: Hand-edit the generated `migration.sql`** — append:

```sql
-- One report per signed-in reporter per listing, enforced at the database.
-- Partial: anonymous reports (reporterId NULL) are never deduped.
-- Prisma cannot express partial indexes; hand-written (see Phase 2 precedent).
CREATE UNIQUE INDEX "Report_one_per_reporter"
  ON "Report"("listingId", "reporterId") WHERE "reporterId" IS NOT NULL;
```

- [ ] **Step 4: Apply + regenerate**

```powershell
npm run db:deploy
npx prisma generate
```

Expected: `1 migration applied`. If `prisma generate` fails with a locked DLL (EPERM), report BLOCKED — the controller must stop the dev server; do not stop it yourself.

- [ ] **Step 5: Write failing tests**

Append to `lib/reports.integration.test.ts` (inside the existing describe, after the dedupe test):

```ts
  it("dedupe survives a race: concurrent duplicate inserts yield one row", async () => {
    // The app-level findFirst check can pass twice concurrently; the partial
    // unique index must make the second insert a duplicate, not a crash.
    const results = await Promise.all([
      createReport(reporterId, listingId, "other", "race a"),
      createReport(reporterId, listingId, "other", "race b"),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await db.report.count({ where: { listingId, reporterId } })).toBe(1);
  });
```

(Note: the earlier test in that file already created one report for `reporterId` — this still holds: the count assertion stays 1 total for that pair.)

Append to `lib/manage.integration.test.ts` (inside the lifecycle describe):

```ts
  it("relist clears the expiry reminder marker", async () => {
    await db.listing.update({
      where: { id: listingId },
      data: { status: "sold", expiryReminderAt: new Date() },
    });
    await relistListing(userId, listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.expiryReminderAt).toBeNull();
  });
```

(Import `relistListing` if not already imported in that file — it is.)

- [ ] **Step 6: Run to verify failure** — `npx vitest run lib/reports.integration.test.ts lib/manage.integration.test.ts` → the race test fails (P2002 throw) and the relist test fails (field kept).

- [ ] **Step 7: Implement**

`lib/reports.ts` — wrap the create:

```ts
  try {
    await db.report.create({
      data: { listingId, reporterId, reason, details: details || null },
    });
  } catch (e) {
    // Partial unique index Report_one_per_reporter: a concurrent duplicate
    // from the same signed-in reporter lost the race — same outcome as the
    // findFirst check, acknowledged identically.
    if ((e as { code?: string }).code === "P2002") return { ok: true, duplicate: true };
    throw e;
  }
```

`lib/manage.ts` `relistListing` — extend the update data:

```ts
    data: { status: "active", expiresAt: new Date(Date.now() + THIRTY_DAYS), expiryReminderAt: null },
```

- [ ] **Step 8: Run to verify pass** — `npx vitest run lib/reports.integration.test.ts lib/manage.integration.test.ts` → PASS. Then full `npx vitest run` → all green.

- [ ] **Step 9: Commit**

```powershell
git add prisma lib/reports.ts lib/manage.ts lib/reports.integration.test.ts lib/manage.integration.test.ts
git commit -m "Add expiryReminderAt and DB-enforced report dedupe"
```

---

### Task 2: Boost tiers module + effective-boost unification

**Files:**
- Create: `lib/boost.ts`
- Create: `lib/boost.test.ts`
- Modify: `lib/saved.ts` (use `effectiveBoostOf`; delete inline duplicate)
- Modify: `lib/search.ts` (cross-reference comment on the SQL CASE)
- Modify: `app/page.tsx` (remove inert `revalidate` export, correct comment)

**Interfaces:**
- Produces: `BOOST_TIERS: Record<"top" | "featured" | "super", { label: string; blurb: string; cents: number; days: number; level: string }>`; `type BoostTierKey = keyof typeof BOOST_TIERS`; `isBoostTierKey(s: string): s is BoostTierKey`; `effectiveBoostOf(level: string, expiresAt: Date | null, now?: Date): 0 | 1 | 2 | 3`.

- [ ] **Step 1: Write failing tests**

`lib/boost.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BOOST_TIERS, isBoostTierKey, effectiveBoostOf } from "@/lib/boost";

describe("BOOST_TIERS", () => {
  it("matches the product brief exactly", () => {
    expect(BOOST_TIERS.top).toMatchObject({ cents: 499, days: 7, level: "top" });
    expect(BOOST_TIERS.featured).toMatchObject({ cents: 999, days: 14, level: "featured" });
    expect(BOOST_TIERS.super).toMatchObject({ cents: 1499, days: 30, level: "super" });
  });
  it("isBoostTierKey guards hostile input", () => {
    expect(isBoostTierKey("super")).toBe(true);
    expect(isBoostTierKey("free")).toBe(false);
    expect(isBoostTierKey("constructor")).toBe(false);
  });
});

describe("effectiveBoostOf — must match lib/search.ts SQL CASE truth table", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);
  it("live boosts rank 0/1/2", () => {
    expect(effectiveBoostOf("super", future)).toBe(0);
    expect(effectiveBoostOf("featured", future)).toBe(1);
    expect(effectiveBoostOf("top", future)).toBe(2);
  });
  it("null expiry, past expiry, none, and unknown levels all rank 3", () => {
    expect(effectiveBoostOf("super", null)).toBe(3);
    expect(effectiveBoostOf("super", past)).toBe(3);
    expect(effectiveBoostOf("none", future)).toBe(3);
    expect(effectiveBoostOf("gold", future)).toBe(3);
  });
  it("expiry exactly now ranks 3 (SQL uses <=)", () => {
    const now = new Date();
    expect(effectiveBoostOf("super", now, now)).toBe(3);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/boost.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/boost.ts`**

```ts
// Boost tiers — the single source of truth for the wizard step, the boost
// picker page, Stripe checkout line items, and the webhook. Prices are
// server-side only; clients ever submit a tier KEY.

export const BOOST_TIERS = {
  top: { label: "Top Ad", blurb: "Appears above standard listings in its category.", cents: 499, days: 7, level: "top" },
  featured: { label: "Featured", blurb: "Featured badge, highlighted border, top placement.", cents: 999, days: 14, level: "featured" },
  super: { label: "Super Boost", blurb: "Everything in Featured plus the homepage featured strip.", cents: 1499, days: 30, level: "super" },
} as const;

export type BoostTierKey = keyof typeof BOOST_TIERS;

export function isBoostTierKey(s: string): s is BoostTierKey {
  return Object.hasOwn(BOOST_TIERS, s);
}

/**
 * Effective boost rank: 0 super, 1 featured, 2 top, 3 none/lapsed.
 * MUST stay in lockstep with the EFFECTIVE_BOOST SQL CASE in lib/search.ts —
 * the SQL orders queries; this orders anything computed in TypeScript.
 * lib/boost.test.ts pins the shared truth table.
 */
export function effectiveBoostOf(
  level: string,
  expiresAt: Date | null,
  now: Date = new Date(),
): 0 | 1 | 2 | 3 {
  if (expiresAt === null || expiresAt <= now) return 3;
  if (level === "super") return 0;
  if (level === "featured") return 1;
  if (level === "top") return 2;
  return 3;
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/boost.test.ts` → PASS (5 tests).

- [ ] **Step 5: Unify consumers**

- `lib/saved.ts`: import `effectiveBoostOf`; in `savedListingsFor`'s map, replace the inline `boostLive`/ternary block with `effectiveBoost: effectiveBoostOf(listing.boostLevel, listing.boostExpiresAt),` and delete the now-unused `boostLive` local.
- `lib/search.ts`: above the `EFFECTIVE_BOOST` Prisma.sql, add one comment line: `// Mirrored in TypeScript by effectiveBoostOf() in lib/boost.ts — change both.`
- `app/page.tsx`: delete the `export const revalidate = 60;` line and its comment, replacing with: `// This route renders dynamically on every request (the layout Header reads the session), so no revalidate window applies.`

- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean; `npx vitest run lib/` green (saved tests still pass with the unified helper).

- [ ] **Step 7: Commit**

```powershell
git add lib/boost.ts lib/boost.test.ts lib/saved.ts lib/search.ts app/page.tsx
git commit -m "Add boost tier table and unify the effective-boost rule"
```

---

### Task 3: Stripe client — checkout session creation (keys-later)

**Files:**
- Modify: `package.json` (add `stripe`)
- Create: `lib/stripe.ts`
- Create: `lib/stripe.integration.test.ts`
- Modify: `lib/env.ts` (append `stripeEnabled`)
- Modify: `.env.example` (Stripe + cron vars in the optional block)

**Interfaces:**
- Consumes: `BOOST_TIERS`, `BoostTierKey` (Task 2); `ownedListing`, `NotOwnerError` (lib/manage); `appUrl`.
- Produces: `stripeEnabled(): boolean` (in lib/env.ts — true iff `STRIPE_SECRET_KEY` set); `class StripeDisabledError extends Error`; `createBoostCheckout(userId: string, listingId: string, tier: BoostTierKey): Promise<string>` — returns the Stripe-hosted checkout URL; throws `StripeDisabledError` when unkeyed, `NotOwnerError` when not the owner, `Error("Listing not boostable")` unless status active + unexpired.

- [ ] **Step 1: Install**

```powershell
npm install stripe@^18.0.0
```

- [ ] **Step 2: Append to `lib/env.ts`**

```ts
export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
```

And add to `.env.example`'s optional block:

```
STRIPE_SECRET_KEY=       # sk_test_... — boost purchases stay "Available soon" without it
STRIPE_WEBHOOK_SECRET=   # whsec_... from the Stripe webhook endpoint
CRON_SECRET=             # long random string; nightly cron fails closed without it
```

- [ ] **Step 3: Write failing tests**

`lib/stripe.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createBoostCheckout, StripeDisabledError } from "@/lib/stripe";
import { NotOwnerError } from "@/lib/manage";

const STAMP = Date.now();
const EMAILS = [`vitest-stripe-own-${STAMP}@example.com`, `vitest-stripe-other-${STAMP}@example.com`];
let ownerId: string, otherId: string, listingId: string;

beforeAll(async () => {
  ownerId = (await db.user.create({ data: { email: EMAILS[0], name: "Owner" } })).id;
  otherId = (await db.user.create({ data: { email: EMAILS[1], name: "Other" } })).id;
  listingId = (await db.listing.create({ data: {
    title: "Boostable fixture", description: "A listing that exists so checkout guards can be tested.",
    category: "electronics", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: ownerId,
  } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  await db.$disconnect();
});
beforeEach(() => { delete process.env.STRIPE_SECRET_KEY; });

describe("createBoostCheckout guards (degraded: no Stripe key)", () => {
  it("throws StripeDisabledError without a key — and checks that FIRST", async () => {
    await expect(createBoostCheckout(ownerId, listingId, "top")).rejects.toThrow(StripeDisabledError);
  });
  it("with a fake key set, non-owners are rejected before any Stripe call", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_never_called";
    await expect(createBoostCheckout(otherId, listingId, "top")).rejects.toThrow(NotOwnerError);
  });
  it("with a fake key set, a sold listing is not boostable", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_never_called";
    await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
    await expect(createBoostCheckout(ownerId, listingId, "super")).rejects.toThrow(/not boostable/i);
    await db.listing.update({ where: { id: listingId }, data: { status: "active" } });
  });
});
```

(The guard ordering means no test ever reaches a real Stripe API call — the fake key is never used. A real checkout-session E2E happens when the user's test-mode keys arrive.)

- [ ] **Step 4: Run to verify failure** — `npx vitest run lib/stripe.integration.test.ts` → FAIL (module missing).

- [ ] **Step 5: Implement `lib/stripe.ts`**

```ts
// Stripe checkout for listing boosts. Keys-later: without STRIPE_SECRET_KEY
// every entry point is hidden and this module refuses. Payment confirmation
// NEVER happens here — the webhook (lib/webhook.ts) is the only writer of
// boost state.

import Stripe from "stripe";
import { db } from "@/lib/db";
import { BOOST_TIERS, type BoostTierKey } from "@/lib/boost";
import { ownedListing } from "@/lib/manage";
import { stripeEnabled, appUrl } from "@/lib/env";

export class StripeDisabledError extends Error {
  constructor() { super("Stripe is not configured"); }
}

export async function createBoostCheckout(
  userId: string,
  listingId: string,
  tier: BoostTierKey,
): Promise<string> {
  if (!stripeEnabled()) throw new StripeDisabledError();

  // Guard order matters: ownership and boostability are checked before any
  // network call so tests (and hostile input) never reach Stripe.
  const listing = await ownedListing(userId, listingId);
  if (listing.status !== "active" || listing.expiresAt <= new Date()) {
    throw new Error("Listing not boostable");
  }

  const t = BOOST_TIERS[tier];
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "cad",
        unit_amount: t.cents,
        product_data: {
          name: `${t.label} — ${t.days} days`,
          description: `Boost for "${listing.title}" on GTASearch`,
        },
      },
    }],
    metadata: { listingId, userId, level: t.level, days: String(t.days) },
    success_url: `${appUrl()}/listing/${listingId}?boost=success`,
    cancel_url: `${appUrl()}/listing/${listingId}/boost?cancelled=1`,
  });

  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}
```

- [ ] **Step 6: Run to verify pass** — `npx vitest run lib/stripe.integration.test.ts` → PASS (3 tests). Then `npx tsc --noEmit`.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json lib/stripe.ts lib/stripe.integration.test.ts lib/env.ts .env.example
git commit -m "Add keys-later Stripe checkout with owner and boostability guards"
```

---

### Task 4: Webhook — replay-safe boost application

**Files:**
- Create: `lib/webhook.ts`
- Create: `lib/webhook.integration.test.ts`
- Create: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `db`; `Stripe` SDK (route only).
- Produces: `interface BoostCheckoutEvent { sessionId: string; amountCents: number; metadata: { listingId?: string; userId?: string; level?: string; days?: string } }`; `applyBoostCheckout(evt: BoostCheckoutEvent): Promise<"applied" | "duplicate" | "invalid" | "listing-missing">` — pure of HTTP, fully testable.

- [ ] **Step 1: Write failing tests**

`lib/webhook.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { applyBoostCheckout } from "@/lib/webhook";

const STAMP = Date.now();
const EMAIL = `vitest-webhook-${STAMP}@example.com`;
let userId: string, listingId: string;

const evt = (sessionId: string, over: Partial<{ listingId: string; level: string; days: string }> = {}) => ({
  sessionId,
  amountCents: 999,
  metadata: { listingId: over.listingId ?? listingId, userId, level: over.level ?? "featured", days: over.days ?? "14" },
});

beforeAll(async () => {
  userId = (await db.user.create({ data: { email: EMAIL, name: "Webhook Test" } })).id;
  listingId = (await db.listing.create({ data: {
    title: "Webhook fixture", description: "A listing that receives test boosts from constructed events.",
    category: "electronics", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId,
  } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } }); // cascades listing + payments
  await db.$disconnect();
});

describe("applyBoostCheckout", () => {
  it("applies a boost and records the payment", async () => {
    const r = await applyBoostCheckout(evt(`cs_test_${STAMP}_a`));
    expect(r).toBe("applied");
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.boostLevel).toBe("featured");
    const days = (row!.boostExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);
    const pay = await db.boostPayment.findUnique({ where: { stripeId: `cs_test_${STAMP}_a` } });
    expect(pay!.status).toBe("paid");
    expect(Number(pay!.amount)).toBeCloseTo(9.99);
  });

  it("is replay-safe: the same session twice yields one payment, no double-apply", async () => {
    const before = await db.listing.findUnique({ where: { id: listingId } });
    const r = await applyBoostCheckout(evt(`cs_test_${STAMP}_a`));
    expect(r).toBe("duplicate");
    expect(await db.boostPayment.count({ where: { stripeId: `cs_test_${STAMP}_a` } })).toBe(1);
    const after = await db.listing.findUnique({ where: { id: listingId } });
    expect(after!.boostExpiresAt!.getTime()).toBe(before!.boostExpiresAt!.getTime());
  });

  it("rejects malformed metadata without writing anything", async () => {
    expect(await applyBoostCheckout(evt(`cs_test_${STAMP}_b`, { level: "gold" }))).toBe("invalid");
    expect(await applyBoostCheckout(evt(`cs_test_${STAMP}_c`, { days: "banana" }))).toBe("invalid");
    expect(await db.boostPayment.count({ where: { stripeId: { in: [`cs_test_${STAMP}_b`, `cs_test_${STAMP}_c`] } } })).toBe(0);
  });

  it("records the payment but skips the listing when it vanished mid-payment", async () => {
    const r = await applyBoostCheckout(evt(`cs_test_${STAMP}_d`, { listingId: "cnonexistent000000000000" }));
    expect(r).toBe("listing-missing");
    const pay = await db.boostPayment.findUnique({ where: { stripeId: `cs_test_${STAMP}_d` } });
    expect(pay).not.toBeNull(); // the money trail survives
    await db.boostPayment.delete({ where: { stripeId: `cs_test_${STAMP}_d` } }); // no cascade path for this one
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/webhook.integration.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/webhook.ts`**

```ts
// Applies a completed Stripe checkout to a listing. HTTP-free: the route
// verifies the signature and maps the Stripe event to BoostCheckoutEvent;
// everything decision-shaped lives here where integration tests reach it.

import { db } from "@/lib/db";
import { isBoostTierKey, BOOST_TIERS } from "@/lib/boost";

export interface BoostCheckoutEvent {
  sessionId: string;
  amountCents: number;
  metadata: { listingId?: string; userId?: string; level?: string; days?: string };
}

export async function applyBoostCheckout(
  evt: BoostCheckoutEvent,
): Promise<"applied" | "duplicate" | "invalid" | "listing-missing"> {
  const { listingId, userId, level, days } = evt.metadata;
  const daysNum = Number(days);
  const tierKey = level ?? "";
  if (!listingId || !userId || !isBoostTierKey(tierKey) || !Number.isInteger(daysNum) || daysNum <= 0) {
    return "invalid";
  }
  // Defense in depth: the duration must match the tier we sell, not whatever
  // arrived in metadata.
  if (BOOST_TIERS[tierKey].days !== daysNum) return "invalid";

  try {
    await db.boostPayment.create({
      data: {
        listingId,
        userId,
        stripeId: evt.sessionId,
        amount: evt.amountCents / 100,
        boostLevel: tierKey,
        duration: daysNum,
        status: "paid",
      },
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    // P2002 on stripeId: webhook replay — already fully processed. Ack.
    if (code === "P2002") return "duplicate";
    // P2003: listing or user FK gone (deleted mid-payment). Keep the money
    // trail without relations.
    if (code === "P2003") {
      await db.boostPayment.createMany({
        data: [{ listingId, userId, stripeId: evt.sessionId, amount: evt.amountCents / 100, boostLevel: tierKey, duration: daysNum, status: "paid" }],
        skipDuplicates: true,
      }).catch(() => {});
      return "listing-missing";
    }
    throw e;
  }

  const updated = await db.listing.updateMany({
    where: { id: listingId },
    data: {
      boostLevel: tierKey,
      boostExpiresAt: new Date(Date.now() + daysNum * 86_400_000),
    },
  });
  return updated.count === 0 ? "listing-missing" : "applied";
}
```

NOTE for implementer: the P2003 branch above tries to preserve the payment row when relations are gone, but `BoostPayment.listingId`/`userId` are required relations — if `createMany` also FK-fails, the catch swallows it and we still return "listing-missing" (the Stripe dashboard remains the money trail). Keep exactly this behaviour and the comment; the test only asserts the missing-listing-with-real-user case, where the row DOES persist… but wait: with a nonexistent `listingId`, the FK will reject in both attempts. Adjust the TEST expectation accordingly: for the `cs_test_${STAMP}_d` case, assert `r === "listing-missing"` and that NO orphan crash occurred; drop the `pay !== null` assertion and the manual delete, and instead assert `await db.boostPayment.findUnique(...)` is null with a comment: "FK constraints make a true orphan row impossible; Stripe's dashboard is the money trail for this edge." This is the correct reconciliation of spec §5 with the actual schema — implement it this way.

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/webhook.integration.test.ts` → PASS (4 tests, with the Step 3 NOTE's test adjustment applied).

- [ ] **Step 5: Create `app/api/stripe/webhook/route.ts`**

```ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { applyBoostCheckout } from "@/lib/webhook";

// Stripe requires the RAW body for signature verification — no JSON parsing
// before constructEvent.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = new Stripe(key).webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true }); // ack everything else
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const result = await applyBoostCheckout({
    sessionId: session.id,
    amountCents: session.amount_total ?? 0,
    metadata: {
      listingId: session.metadata?.listingId,
      userId: session.metadata?.userId,
      level: session.metadata?.level,
      days: session.metadata?.days,
    },
  });
  // Always 200 once verified: Stripe retries non-2xx, and every branch here
  // is terminal (applied/duplicate/invalid/listing-missing).
  return NextResponse.json({ received: true, result });
}
```

- [ ] **Step 6: Verify** — `npx tsc --noEmit`; full `npx vitest run` green.

- [ ] **Step 7: Commit**

```powershell
git add lib/webhook.ts lib/webhook.integration.test.ts app/api/stripe
git commit -m "Add replay-safe Stripe webhook applying boosts from verified events"
```

---

### Task 5: Boost UI — wizard step, picker page, dashboard entry, success banner

**Files:**
- Modify: `app/post-ad/boost/page.tsx` (live cards when Stripe enabled)
- Modify: `app/post-ad/actions.ts` (add `publishWithBoostAction`)
- Create: `app/listing/[id]/boost/page.tsx`
- Create: `app/listing/[id]/boost/actions.ts`
- Create: `app/listing/[id]/boost/BoostPicker.tsx`
- Modify: `app/dashboard/MyAdRow.tsx` (Boost link on active rows when Stripe enabled)
- Modify: `app/listing/[id]/page.tsx` (owner "Boost this ad" link; `?boost=success` banner)

**Interfaces:**
- Consumes: `stripeEnabled`, `createBoostCheckout`, `StripeDisabledError`, `BOOST_TIERS`, `isBoostTierKey`, `effectiveBoostOf`, `publishDraft`, `rateLimit`, `requireUserId`, `FormState`, `formatPrice` patterns.
- Produces: server actions `publishWithBoostAction` (wizard) and `startBoostCheckoutAction` (picker page), both submitting a `tier` field validated by `isBoostTierKey`.

- [ ] **Step 1: Add `publishWithBoostAction` to `app/post-ad/actions.ts`**

```ts
import { isBoostTierKey } from "@/lib/boost";
import { createBoostCheckout, StripeDisabledError } from "@/lib/stripe";

/**
 * Wizard boost step, paid path (spec §4: publish first, then pay). The ad
 * goes live unconditionally; an abandoned checkout costs nothing. Free path
 * continues to review via the plain link.
 */
export async function publishWithBoostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const tier = String(formData.get("tier") ?? "");
  if (!isBoostTierKey(tier)) return { ok: false, error: "Pick a boost option." };
  if (!rateLimit(`publish:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "You've reached the daily posting limit." };
  }
  if (!rateLimit(`boost:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Too many checkout attempts today." };
  }

  const r = await publishDraft(userId);
  if (!r.ok) return { ok: false, error: r.error };

  let url: string;
  try {
    url = await createBoostCheckout(userId, r.listingId, tier);
  } catch (e) {
    if (e instanceof StripeDisabledError) {
      // Ad is live; payment just isn't possible. Land on the listing honestly.
      redirect(`/listing/${r.listingId}`);
    }
    // Checkout failed but the ad is published — never strand the seller.
    redirect(`/listing/${r.listingId}?boost=checkout-failed`);
  }
  redirect(url);
}
```

- [ ] **Step 2: Rewrite `app/post-ad/boost/page.tsx`**

Keep the gate preamble (requireUserId, getDraft, firstIncompleteStep, redirects) exactly as-is. Replace the body:

- When `!stripeEnabled()`: render the current markup unchanged (free card checked, paid cards `opacity-60` + "Available soon", Continue link to review).
- When `stripeEnabled()`: render `<BoostStepForm />` — a client component in the same folder (`BoostStepForm.tsx`) using `useFormState(publishWithBoostAction, { ok: false })`: the free option as a styled `<Link href="/post-ad/review">` card ("Free listing — continue to review"), and the three `BOOST_TIERS` entries as selectable radio cards (`name="tier"`, values top/featured/super, brand ring on checked via `peer-checked:` classes), a note "Your ad publishes immediately; payment opens in Stripe's secure checkout.", `state?.error` in red, and a submit button "Publish & pay". Iterate `Object.entries(BOOST_TIERS)` — format price as `$${(t.cents / 100).toFixed(2)}`.

- [ ] **Step 3: Create the picker page**

`app/listing/[id]/boost/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { isBoostTierKey } from "@/lib/boost";
import { createBoostCheckout, StripeDisabledError } from "@/lib/stripe";
import { NotOwnerError } from "@/lib/manage";
import { rateLimit } from "@/lib/rate-limit";
import type { FormState } from "@/app/auth/actions";

export async function startBoostCheckoutAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  const tier = String(formData.get("tier") ?? "");
  if (!isBoostTierKey(tier)) return { ok: false, error: "Pick a boost tier." };
  if (!rateLimit(`boost:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Too many checkout attempts today. Try again tomorrow." };
  }

  let url: string;
  try {
    url = await createBoostCheckout(userId, listingId, tier);
  } catch (e) {
    if (e instanceof StripeDisabledError) return { ok: false, error: "Payments aren't configured yet." };
    if (e instanceof NotOwnerError) return { ok: false, error: "You can only boost your own listings." };
    if (e instanceof Error && /not boostable/i.test(e.message)) {
      return { ok: false, error: "Only active listings can be boosted." };
    }
    throw e;
  }
  redirect(url);
}
```

`app/listing/[id]/boost/page.tsx` (server): `requireUserId()`; load the listing via `db.listing.findUnique` selecting `id, title, status, expiresAt, boostLevel, boostExpiresAt, userId`; `notFound()` if missing or `userId !== viewer` or status not active or expired; if `!stripeEnabled()` render the "Payments aren't configured yet" card with a back link instead of the picker. Show current boost state via `effectiveBoostOf` (e.g. "Currently boosted: Featured, N days left" or "No active boost") and `searchParams.cancelled` → an amber "Checkout cancelled — no charge was made." note. Then `<BoostPicker listingId={listing.id} />` (client): radio cards over `BOOST_TIERS` + submit "Continue to payment" via `useFormState(startBoostCheckoutAction, { ok: false })`, `state?.error` in red, metadata `robots: { index: false }`.

- [ ] **Step 4: Entry points**

- `app/dashboard/MyAdRow.tsx`: for rows whose display status is Active, add a "Boost" link (styled like the existing Edit link) to `/listing/${id}/boost` — rendered only when `stripeEnabled()` (import from `@/lib/env`; MyAdRow is a server component).
- `app/listing/[id]/page.tsx`: in the owner branch (where "Edit your listing" renders), add below it, only when `stripeEnabled()` and the listing is active: a secondary link "Boost this ad" to `/listing/${listing.id}/boost`.

- [ ] **Step 5: Success banner** — `app/listing/[id]/page.tsx`: accept `searchParams: { boost?: string }`; at the top of the main column render:

```tsx
{searchParams.boost === "success" && (
  <p className="mb-4 rounded-card bg-brand-50 px-4 py-3 text-sm font-medium text-brand-dark">
    Boost payment received — your placement updates within a minute.
  </p>
)}
{searchParams.boost === "checkout-failed" && (
  <p className="mb-4 rounded-card bg-amber-50 px-4 py-3 text-sm text-amber-700">
    Your ad is live, but the payment page couldn't be opened. You can boost it any time from your dashboard.
  </p>
)}
```

(The banner never writes anything — the webhook is the only writer.)

- [ ] **Step 6: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green. Degraded-mode render check is the controller's browser pass (Task 7).

- [ ] **Step 7: Commit**

```powershell
git add app/post-ad app/listing app/dashboard
git commit -m "Add boost purchase UI: wizard paid path, picker page, dashboard entry"
```

---

### Task 6: Nightly cron — four jobs, fail-closed endpoint, schedule

**Files:**
- Create: `lib/cron.ts`
- Create: `lib/cron.integration.test.ts`
- Modify: `lib/email.ts` (append `sendExpiryReminderEmail`)
- Create: `app/api/cron/nightly/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `db`, `resendEnabled`, `appUrl`, Resend pattern in lib/email.ts.
- Produces: `expireListings(now?): Promise<number>`; `downgradeLapsedBoosts(now?): Promise<number>`; `sweepStaleDrafts(now?): Promise<number>`; `sendExpiryReminders(send?: (to: string, args: { title: string; daysLeft: number; dashboardUrl: string }) => Promise<boolean>, now?: Date): Promise<number>` (injectable sender; default the real email); `sendExpiryReminderEmail(to, args): Promise<boolean>`.

- [ ] **Step 1: Write failing tests**

`lib/cron.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { expireListings, downgradeLapsedBoosts, sweepStaleDrafts, sendExpiryReminders } from "@/lib/cron";

const STAMP = Date.now();
const EMAIL = `vitest-cron-${STAMP}@example.com`;
let userId: string;
const DAY = 86_400_000;

const mk = (over: Record<string, unknown>) => db.listing.create({ data: {
  title: `Cron fixture ${Math.random().toString(36).slice(2, 8)}`,
  description: "Fixture for nightly cron behaviour tests, cleaned up afterwards.",
  category: "electronics", city: "toronto", images: [], status: "active",
  expiresAt: new Date(Date.now() + 30 * DAY), userId, ...over,
} });

beforeAll(async () => {
  userId = (await db.user.create({ data: { email: EMAIL, name: "Cron Test" } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

describe("nightly cron jobs", () => {
  it("expireListings flips only active listings past expiry", async () => {
    const past = await mk({ expiresAt: new Date(Date.now() - DAY) });
    const future = await mk({});
    const sold = await mk({ status: "sold", expiresAt: new Date(Date.now() - DAY) });
    const n = await expireListings();
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await db.listing.findUnique({ where: { id: past.id } }))!.status).toBe("expired");
    expect((await db.listing.findUnique({ where: { id: future.id } }))!.status).toBe("active");
    expect((await db.listing.findUnique({ where: { id: sold.id } }))!.status).toBe("sold");
  });

  it("downgradeLapsedBoosts clears only lapsed boosts", async () => {
    const lapsed = await mk({ boostLevel: "featured", boostExpiresAt: new Date(Date.now() - DAY) });
    const live = await mk({ boostLevel: "super", boostExpiresAt: new Date(Date.now() + DAY) });
    await downgradeLapsedBoosts();
    const l = await db.listing.findUnique({ where: { id: lapsed.id } });
    expect(l!.boostLevel).toBe("none");
    expect(l!.boostExpiresAt).toBeNull();
    expect((await db.listing.findUnique({ where: { id: live.id } }))!.boostLevel).toBe("super");
  });

  it("sweepStaleDrafts deletes only old drafts", async () => {
    const oldDraft = await mk({ status: "draft", createdAt: new Date(Date.now() - 8 * DAY) });
    const freshDraft = await mk({ status: "draft" });
    await sweepStaleDrafts();
    expect(await db.listing.findUnique({ where: { id: oldDraft.id } })).toBeNull();
    expect(await db.listing.findUnique({ where: { id: freshDraft.id } })).not.toBeNull();
  }, 20_000);

  it("sendExpiryReminders emails once per cycle via the injected sender, marking only successes", async () => {
    const due = await mk({ expiresAt: new Date(Date.now() + 2 * DAY) });
    const notDue = await mk({ expiresAt: new Date(Date.now() + 10 * DAY) });
    const sent: string[] = [];
    const okSender = async (_to: string, args: { title: string }) => { sent.push(args.title); return true; };

    const n1 = await sendExpiryReminders(okSender);
    expect(n1).toBeGreaterThanOrEqual(1);
    const dueRow = await db.listing.findUnique({ where: { id: due.id } });
    expect(dueRow!.expiryReminderAt).not.toBeNull();
    expect((await db.listing.findUnique({ where: { id: notDue.id } }))!.expiryReminderAt).toBeNull();

    // Second run: already marked — nothing new for this listing.
    const before = sent.length;
    await sendExpiryReminders(okSender);
    expect(sent.length).toBe(before);

    // Failed sends stay unmarked so the next run retries.
    const due2 = await mk({ expiresAt: new Date(Date.now() + 2 * DAY) });
    const failSender = async () => false;
    await sendExpiryReminders(failSender);
    expect((await db.listing.findUnique({ where: { id: due2.id } }))!.expiryReminderAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/cron.integration.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/cron.ts`**

```ts
// The four nightly jobs (spec §6). Pure of HTTP: the route wraps these with
// bearer auth. Each returns a count for the cron's JSON report.

import { db } from "@/lib/db";
import { sendExpiryReminderEmail } from "@/lib/email";
import { appUrl, resendEnabled } from "@/lib/env";

const DAY = 86_400_000;
const REMINDER_WINDOW_DAYS = 3;
const REMINDER_CAP = 50; // Resend free tier is 100/day; leave headroom.

export async function expireListings(now: Date = new Date()): Promise<number> {
  const r = await db.listing.updateMany({
    where: { status: "active", expiresAt: { lt: now } },
    data: { status: "expired" },
  });
  return r.count;
}

export async function downgradeLapsedBoosts(now: Date = new Date()): Promise<number> {
  // Bookkeeping only: search already ignores lapsed boosts via the
  // effective-boost rule, so nothing is wrongly promoted before this runs.
  const r = await db.listing.updateMany({
    where: { boostLevel: { not: "none" }, boostExpiresAt: { lt: now } },
    data: { boostLevel: "none", boostExpiresAt: null },
  });
  return r.count;
}

export async function sweepStaleDrafts(now: Date = new Date()): Promise<number> {
  // Global version of the per-user sweep in lib/draft.ts (kept as
  // belt-and-braces).
  const r = await db.listing.deleteMany({
    where: { status: "draft", createdAt: { lt: new Date(now.getTime() - 7 * DAY) } },
  });
  return r.count;
}

type ReminderSender = (
  to: string,
  args: { title: string; daysLeft: number; dashboardUrl: string },
) => Promise<boolean>;

export async function sendExpiryReminders(
  send: ReminderSender = sendExpiryReminderEmail,
  now: Date = new Date(),
): Promise<number> {
  // Degraded mode: leave everything unmarked so reminders flow the day the
  // email key arrives. (Injected senders in tests bypass this gate.)
  if (send === sendExpiryReminderEmail && !resendEnabled()) return 0;

  const due = await db.listing.findMany({
    where: {
      status: "active",
      expiryReminderAt: null,
      expiresAt: { gt: now, lt: new Date(now.getTime() + REMINDER_WINDOW_DAYS * DAY) },
    },
    select: {
      id: true, title: true, expiresAt: true,
      user: { select: { email: true } },
    },
    take: REMINDER_CAP,
  });

  let sent = 0;
  for (const l of due) {
    const daysLeft = Math.max(1, Math.ceil((l.expiresAt.getTime() - now.getTime()) / DAY));
    const ok = await send(l.user.email, {
      title: l.title, daysLeft, dashboardUrl: `${appUrl()}/dashboard`,
    }).catch(() => false);
    if (ok) {
      // Mark only successes; failures retry on the next run.
      await db.listing.update({ where: { id: l.id }, data: { expiryReminderAt: now } });
      sent++;
    }
  }
  return sent;
}
```

- [ ] **Step 4: Append to `lib/email.ts`**

```ts
export async function sendExpiryReminderEmail(
  to: string,
  args: { title: string; daysLeft: number; dashboardUrl: string },
): Promise<boolean> {
  if (!resendEnabled()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "GTASearch <onboarding@resend.dev>",
      to,
      subject: `Your ad "${args.title}" expires in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}`,
      text: `Your GTASearch ad "${args.title}" expires in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}.\n\nRelist it free in one click from your dashboard:\n${args.dashboardUrl}\n\nIf it sold — congratulations! Mark it sold from the same page.`,
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run to verify pass** — `npx vitest run lib/cron.integration.test.ts` → PASS (4 tests).

- [ ] **Step 6: Create the route and schedule**

`app/api/cron/nightly/route.ts`:

```ts
import { NextResponse } from "next/server";
import { expireListings, downgradeLapsedBoosts, sweepStaleDrafts, sendExpiryReminders } from "@/lib/cron";

export const maxDuration = 60;

// Vercel Cron calls GET with Authorization: Bearer ${CRON_SECRET}.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: an unset secret disables the endpoint rather than opening it.
  if (!secret) return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Each job isolated: one failure must not stop the rest.
  const safe = (p: Promise<number>) => p.catch((e) => { console.error("cron job failed:", e); return -1; });
  const [expired, downgraded, draftsSwept, remindersSent] = [
    await safe(expireListings()),
    await safe(downgradeLapsedBoosts()),
    await safe(sweepStaleDrafts()),
    await safe(sendExpiryReminders()),
  ];
  return NextResponse.json({ expired, downgraded, draftsSwept, remindersSent });
}
```

`vercel.json` (repo root):

```json
{
  "crons": [
    { "path": "/api/cron/nightly", "schedule": "0 6 * * *" }
  ]
}
```

- [ ] **Step 7: Verify** — `npx tsc --noEmit`; full `npx vitest run` green.

- [ ] **Step 8: Commit**

```powershell
git add lib/cron.ts lib/cron.integration.test.ts lib/email.ts app/api/cron vercel.json
git commit -m "Add fail-closed nightly cron: expiry, boost downgrade, draft sweep, reminders"
```

---

### Task 7: Final verification, docs, deploy (controller-run)

**Files:**
- Modify: `README.md` (Phase 3B section + new env vars)

- [ ] **Step 1:** Full `npx vitest run` green; `npx tsc --noEmit` clean.
- [ ] **Step 2:** Stop dev server → `npm run build` → clean → restart dev.
- [ ] **Step 3:** Browser (degraded, no Stripe keys): wizard boost step shows "Available soon" cards exactly as before; `/listing/[id]/boost` for an owned listing shows "Payments aren't configured yet"; no Boost buttons on dashboard/listing page. With a fixture: cron endpoint 401s without bearer, 503s without CRON_SECRET, runs with it (set locally in .env for the test) returning JSON counts.
- [ ] **Step 4:** README: Phase 3B section (boost flow, cron, env vars incl. CRON_SECRET note "set in Vercel before the cron is trusted"); note the Stripe test checklist for when keys arrive (set both keys locally + Vercel, create webhook endpoint pointing at https://www.gtasearch.com/api/stripe/webhook with checkout.session.completed, test-mode card 4242…).
- [ ] **Step 5:** Ledger, commit, final whole-branch review (most capable model), fix wave if needed, merge to master, push (auto-deploys), live verification: `/api/cron/nightly` unauthorized → 401/503; homepage healthy; boost picker 404s for anonymous.
- [ ] **Step 6:** Set `CRON_SECRET` reminder to the user for Vercel env (generate value for them), since the cron fails closed until it exists.

---

## Self-review notes

- **Spec coverage:** §2 → Task 1. §3 → Task 2. §4 → Tasks 3, 5. §5 → Task 4. §6 → Task 6. §7 cleanups → Task 2 Steps 5. §8 env → Tasks 3, 6. §9 invariants → guard tests (T3), signature route (T4), fail-closed cron (T6), server-side tiers (T2/T5). §10 testing → per-task. §11 DoD → Task 7.
- **Type consistency:** `BoostTierKey` produced in T2, consumed T3/T4/T5; `createBoostCheckout(userId, listingId, tier)` signature consistent across T3/T5; cron function names identical in T6 lib/tests/route; `FormState` reused throughout.
- **Known reconciliation:** T4 Step 3's NOTE resolves the spec §5 "record payment even when listing missing" clause against the schema's required FKs — the money trail for that edge is Stripe's own dashboard; test asserts accordingly. This is flagged for the task reviewer rather than silently chosen.
