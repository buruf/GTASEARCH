# GTASearch Phase 4 — Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An env-gated `/admin` console: overview stats, a reports queue with dismiss/remove, and all-status listing search with takedown and restore.

**Architecture:** All logic in `lib/admin.ts` with thin server actions, per the codebase's established pattern. Admin = session email matching `adminEmail()` (existing helper); `requireAdmin()` 404s everyone else and runs on every page AND every action. No migration, no email, no new dependencies.

**Tech Stack:** Next.js 14 App Router, Prisma 6, Vitest. Existing helpers only.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-31-gtasearch-phase4-admin-design.md`. All prior-phase invariants remain binding.
- Degraded: `ADMIN_EMAIL` unset → every `/admin` route 404s for everyone (`isAdminEmail` returns false when admin env is null).
- Signed-in non-admins get `notFound()` — never a 403. Anonymous users are bounced by middleware (matcher gains `/admin`, `/admin/:path*`).
- Soft-delete only (`status: "deleted"`), matching seller deletes; restore = `status: "active"`, `expiresAt` now+30d, `expiryReminderAt` null (same cycle reset as relist).
- Live production DB: integration tests self-provision `vitest-*@example.com` fixtures, clean up in afterAll; NEVER db:seed/reset; no `npm run build` while dev server runs; don't start/stop dev servers (controller owns them).
- Existing interfaces: `adminEmail()` (lib/env — returns `process.env.ADMIN_EMAIL || null`), `authOptions`/`getServerSession` (lib/auth), `db`, `formatPrice`/`formatRelativeTime` (lib/format), `REPORT_REASONS` (lib/validation), `getCityLabel` (lib/cities), `FormState` (app/auth/actions), design tokens (`brand`, `ink`, `surface`, `line`, `rounded-card`/`rounded-btn`), status-chip colors as in `app/saved/page.tsx` (amber for expired, grey for sold/removed).
- Tests manipulating `process.env.ADMIN_EMAIL` must save/restore it (pattern in `lib/env.test.ts`).
- Windows; commands from `C:\Users\buruf\Documents\gtasearch`; commit per task with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Admin core — `lib/admin.ts`

**Files:**
- Create: `lib/admin.ts`
- Create: `lib/admin.test.ts` (pure)
- Create: `lib/admin.integration.test.ts`
- Modify: `middleware.ts` (matcher gains `"/admin", "/admin/:path*"`)

**Interfaces:**
- Produces (exact, later tasks import these):
  - `isAdminEmail(email: string | null | undefined): boolean` (pure; false when env unset)
  - `requireAdmin(): Promise<string>` (admin userId or `notFound()`)
  - `adminStats(): Promise<{ users: number; activeListings: number; drafts: number; sold: number; expired: number; openReports: number; boostRevenue: number; unreadMessages: number }>` (boostRevenue in dollars)
  - `interface QueueGroup { listing: { id: string; title: string; status: string; images: string[]; city: string; seller: { name: string; email: string } }; reports: { id: string; reason: string; details: string | null; reporterName: string | null; createdAt: Date }[] }`
  - `openReportsByListing(): Promise<QueueGroup[]>` (most-reported first, then newest report)
  - `dismissReports(listingId: string): Promise<number>` / `removeListingWithReports(listingId: string): Promise<number>` / `restoreListing(listingId: string): Promise<void>` (counts = reports transitioned)
  - `interface AdminListingRow { id: string; title: string; status: string; images: string[]; views: number; createdAt: Date; expiresAt: Date; seller: { email: string } }`
  - `adminSearchListings(q: string): Promise<AdminListingRow[]>` (title OR seller-email contains, case-insensitive, all statuses, take 50, newest first; empty q → newest 50)

- [ ] **Step 1: Write failing pure tests**

`lib/admin.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { isAdminEmail } from "@/lib/admin";

const saved = process.env.ADMIN_EMAIL;
beforeEach(() => { delete process.env.ADMIN_EMAIL; });
afterAll(() => { if (saved !== undefined) process.env.ADMIN_EMAIL = saved; });

describe("isAdminEmail", () => {
  it("is false for everyone when ADMIN_EMAIL is unset (degraded mode)", () => {
    expect(isAdminEmail("owner@example.com")).toBe(false);
  });
  it("matches case-insensitively with trimming", () => {
    process.env.ADMIN_EMAIL = " Owner@Example.com ";
    expect(isAdminEmail("owner@example.com")).toBe(true);
    expect(isAdminEmail("OWNER@EXAMPLE.COM")).toBe(true);
  });
  it("rejects non-matching and empty emails", () => {
    process.env.ADMIN_EMAIL = "owner@example.com";
    expect(isAdminEmail("intruder@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/admin.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/admin.ts`**

```ts
// Admin console core. One admin, env-driven: the session email must match
// ADMIN_EMAIL. requireAdmin() 404s everyone else (never a 403 — admin routes
// must be unconfirmable), and every server action re-checks it: the pages are
// convenience, the actions are the gate.

import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminEmail } from "@/lib/env";
import { db } from "@/lib/db";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = adminEmail();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin.trim().toLowerCase();
}

export async function requireAdmin(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminEmail(session.user.email)) notFound();
  return session.user.id;
}

export async function adminStats() {
  const now = new Date();
  const [users, activeListings, drafts, sold, expired, openReports, revenue, unreadMessages] =
    await Promise.all([
      db.user.count(),
      db.listing.count({ where: { status: "active", expiresAt: { gt: now } } }),
      db.listing.count({ where: { status: "draft" } }),
      db.listing.count({ where: { status: "sold" } }),
      db.listing.count({
        where: { OR: [{ status: "expired" }, { status: "active", expiresAt: { lte: now } }] },
      }),
      db.report.count({ where: { status: "open" } }),
      db.boostPayment.aggregate({ _sum: { amount: true }, where: { status: "paid" } }),
      db.message.count({ where: { readAt: null } }),
    ]);
  return {
    users, activeListings, drafts, sold, expired, openReports,
    boostRevenue: Number(revenue._sum.amount ?? 0),
    unreadMessages,
  };
}

export interface QueueGroup {
  listing: {
    id: string; title: string; status: string; images: string[]; city: string;
    seller: { name: string; email: string };
  };
  reports: {
    id: string; reason: string; details: string | null;
    reporterName: string | null; createdAt: Date;
  }[];
}

export async function openReportsByListing(): Promise<QueueGroup[]> {
  const rows = await db.report.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, reason: true, details: true, createdAt: true,
      reporter: { select: { name: true } },
      listing: {
        select: {
          id: true, title: true, status: true, images: true, city: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const groups = new Map<string, QueueGroup>();
  for (const r of rows) {
    let g = groups.get(r.listing.id);
    if (!g) {
      g = {
        listing: {
          id: r.listing.id, title: r.listing.title, status: r.listing.status,
          images: r.listing.images, city: r.listing.city,
          seller: { name: r.listing.user.name, email: r.listing.user.email },
        },
        reports: [],
      };
      groups.set(r.listing.id, g);
    }
    g.reports.push({
      id: r.id, reason: r.reason, details: r.details,
      reporterName: r.reporter?.name ?? null, createdAt: r.createdAt,
    });
  }
  // Most-reported first; rows are newest-first so each group's first report
  // is its newest — stable tiebreak on that.
  return [...groups.values()].sort(
    (a, b) => b.reports.length - a.reports.length ||
      b.reports[0].createdAt.getTime() - a.reports[0].createdAt.getTime(),
  );
}

export async function dismissReports(listingId: string): Promise<number> {
  const r = await db.report.updateMany({
    where: { listingId, status: "open" },
    data: { status: "dismissed" },
  });
  return r.count;
}

export async function removeListingWithReports(listingId: string): Promise<number> {
  const [, reports] = await db.$transaction([
    db.listing.updateMany({ where: { id: listingId }, data: { status: "deleted" } }),
    db.report.updateMany({ where: { listingId, status: "open" }, data: { status: "actioned" } }),
  ]);
  return reports.count;
}

export async function restoreListing(listingId: string): Promise<void> {
  // Same cycle reset as a seller relist: fresh 30 days, reminder re-armed.
  await db.listing.updateMany({
    where: { id: listingId, status: "deleted" },
    data: { status: "active", expiresAt: new Date(Date.now() + THIRTY_DAYS), expiryReminderAt: null },
  });
}

export interface AdminListingRow {
  id: string; title: string; status: string; images: string[];
  views: number; createdAt: Date; expiresAt: Date;
  seller: { email: string };
}

export async function adminSearchListings(q: string): Promise<AdminListingRow[]> {
  const term = q.trim();
  const rows = await db.listing.findMany({
    where: term
      ? {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { user: { email: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, title: true, status: true, images: true, views: true,
      createdAt: true, expiresAt: true,
      user: { select: { email: true } },
    },
  });
  return rows.map((r) => ({ ...r, seller: { email: r.user.email }, user: undefined }) as unknown as AdminListingRow);
}
```

NOTE for implementer on the last line: prefer a clean map — build the object explicitly (`{ id: r.id, ... seller: { email: r.user.email } }`) rather than the spread-and-undefined trick shown; the interface must not carry a `user` key.

- [ ] **Step 4: Run pure tests** — `npx vitest run lib/admin.test.ts` → PASS (3 tests).

- [ ] **Step 5: Write + run integration tests**

`lib/admin.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  adminStats, openReportsByListing, dismissReports,
  removeListingWithReports, restoreListing, adminSearchListings,
} from "@/lib/admin";
import { getPublicListing } from "@/lib/listing";

const STAMP = Date.now();
const EMAILS = [`vitest-adm-seller-${STAMP}@example.com`, `vitest-adm-rep-${STAMP}@example.com`];
let sellerId: string, reporterId: string, listingId: string;

beforeAll(async () => {
  sellerId = (await db.user.create({ data: { email: EMAILS[0], name: "Adm Seller" } })).id;
  reporterId = (await db.user.create({ data: { email: EMAILS[1], name: "Adm Reporter" } })).id;
  listingId = (await db.listing.create({ data: {
    title: `Admin fixture zzq${STAMP}`, description: "Fixture listing for admin console tests, cleaned up after.",
    category: "electronics", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: sellerId,
  } })).id;
  await db.report.create({ data: { listingId, reporterId, reason: "scam" } });
  await db.report.create({ data: { listingId, reporterId: null, reason: "other", details: "anon detail" } });
});

afterAll(async () => {
  await db.report.deleteMany({ where: { listingId } });
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  await db.$disconnect();
});

describe("reports queue", () => {
  it("groups open reports under the listing with reporter names crossed in", async () => {
    const groups = await openReportsByListing();
    const g = groups.find((x) => x.listing.id === listingId)!;
    expect(g.reports).toHaveLength(2);
    expect(g.listing.seller.email).toBe(EMAILS[0]);
    const names = g.reports.map((r) => r.reporterName);
    expect(names).toContain("Adm Reporter");
    expect(names).toContain(null); // anonymous
  });

  it("dismiss closes all open reports and leaves the listing alone", async () => {
    expect(await dismissReports(listingId)).toBe(2);
    expect((await openReportsByListing()).find((x) => x.listing.id === listingId)).toBeUndefined();
    expect((await db.listing.findUnique({ where: { id: listingId } }))!.status).toBe("active");
    // Re-open for the next test.
    await db.report.updateMany({ where: { listingId }, data: { status: "open" } });
  });

  it("remove soft-deletes the listing, actions its reports, hides it publicly", async () => {
    expect(await removeListingWithReports(listingId)).toBe(2);
    expect((await db.listing.findUnique({ where: { id: listingId } }))!.status).toBe("deleted");
    expect(await db.report.count({ where: { listingId, status: "actioned" } })).toBe(2);
    expect(await getPublicListing(listingId)).toBeNull();
  });

  it("restore reactivates with a fresh ~30-day expiry and re-armed reminder", async () => {
    await restoreListing(listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.status).toBe("active");
    expect(row!.expiryReminderAt).toBeNull();
    const days = (row!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(await getPublicListing(listingId)).not.toBeNull();
  });
});

describe("search and stats", () => {
  it("finds by title fragment and by seller email, any status", async () => {
    await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
    const byTitle = await adminSearchListings(`zzq${STAMP}`);
    expect(byTitle.some((r) => r.id === listingId)).toBe(true);
    const byEmail = await adminSearchListings(EMAILS[0]);
    expect(byEmail.some((r) => r.id === listingId)).toBe(true);
    expect(byEmail.find((r) => r.id === listingId)!.seller.email).toBe(EMAILS[0]);
    await db.listing.update({ where: { id: listingId }, data: { status: "active" } });
  });

  it("stats counts move with fixtures", async () => {
    const s = await adminStats();
    expect(s.users).toBeGreaterThanOrEqual(2);
    expect(s.activeListings).toBeGreaterThanOrEqual(1);
    expect(typeof s.boostRevenue).toBe("number");
  });
});
```

Run: `npx vitest run lib/admin.integration.test.ts` → PASS (6 tests).

- [ ] **Step 6: Middleware matcher** — add `"/admin", "/admin/:path*"` to the array in `middleware.ts`.

- [ ] **Step 7: Full suite + commit**

```powershell
npx vitest run
git add lib/admin.ts lib/admin.test.ts lib/admin.integration.test.ts middleware.ts
git commit -m "Add admin core: env-gated access, queue, takedown, search"
```

---

### Task 2: Admin layout, overview page, actions module

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `adminStats`, `dismissReports`, `removeListingWithReports`, `restoreListing` (Task 1); `formatPrice` (lib/format).
- Produces: server actions `dismissReportsAction(formData)`, `removeListingAction(formData)`, `restoreListingAction(formData)` — each takes hidden `listingId`, re-runs `requireAdmin()`, calls its lib fn, `revalidatePath("/admin/reports")` and `revalidatePath("/admin/listings")` and `revalidatePath("/admin")`.

- [ ] **Step 1: Create `app/admin/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, dismissReports, removeListingWithReports, restoreListing } from "@/lib/admin";

// Every action re-checks admin: pages are convenience, actions are the gate.
async function guarded(fn: (listingId: string) => Promise<unknown>, formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "");
  if (listingId) await fn(listingId);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/listings");
}

export async function dismissReportsAction(formData: FormData) { await guarded(dismissReports, formData); }
export async function removeListingAction(formData: FormData) { await guarded(removeListingWithReports, formData); }
export async function restoreListingAction(formData: FormData) { await guarded(restoreListing, formData); }
```

- [ ] **Step 2: Create `app/admin/layout.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// Tabs only — every page under /admin calls requireAdmin() itself, and every
// action re-checks. The layout renders no privileged data.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const tab = "rounded-btn px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-surface-alt hover:text-ink";
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <h1 className="mr-4 text-xl font-bold text-ink">Admin</h1>
        <Link href="/admin" className={tab}>Overview</Link>
        <Link href="/admin/reports" className={tab}>Reports</Link>
        <Link href="/admin/listings" className={tab}>Listings</Link>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/admin/page.tsx`**

```tsx
import Link from "next/link";
import { requireAdmin, adminStats } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatRelativeTime } from "@/lib/format";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const s = await adminStats();
  const recent = await db.listing.findMany({
    orderBy: { createdAt: "desc" }, take: 5,
    select: { id: true, title: true, status: true, createdAt: true },
  });

  const cards: [string, string | number][] = [
    ["Users", s.users],
    ["Active listings", s.activeListings],
    ["Open reports", s.openReports],
    ["Boost revenue", `$${s.boostRevenue.toFixed(2)}`],
    ["Drafts", s.drafts],
    ["Sold", s.sold],
    ["Expired", s.expired],
    ["Unread messages", s.unreadMessages],
  ];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <li key={label} className="rounded-card border border-line bg-surface p-4">
            <p className="text-2xl font-bold text-ink">{value}</p>
            <p className="mt-1 text-xs text-ink-muted">{label}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-base font-bold text-ink">Newest listings</h2>
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {recent.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <Link href={`/listing/${l.id}`} className="truncate font-medium text-brand hover:underline">
              {l.title || "(untitled draft)"}
            </Link>
            <span className="shrink-0 text-xs text-ink-muted">{l.status} · {formatRelativeTime(l.createdAt)}</span>
          </li>
        ))}
        {recent.length === 0 && <li className="p-3 text-sm text-ink-muted">No listings yet.</li>}
      </ul>
    </>
  );
}
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green. (Browser pass is the controller's final task.)

- [ ] **Step 5: Commit**

```powershell
git add app/admin
git commit -m "Add admin layout, overview stats, and guarded action module"
```

---

### Task 3: Reports queue page

**Files:**
- Create: `app/admin/reports/page.tsx`
- Create: `app/admin/reports/QueueActions.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `openReportsByListing`, `QueueGroup` (Task 1); `dismissReportsAction`, `removeListingAction` (Task 2); `REPORT_REASONS` (lib/validation); `formatRelativeTime`, `getCityLabel`.

- [ ] **Step 1: Create `app/admin/reports/QueueActions.tsx`** (client — confirm on remove)

```tsx
"use client";

import { dismissReportsAction, removeListingAction } from "@/app/admin/actions";

export function QueueActions({ listingId, listingStatus }: { listingId: string; listingStatus: string }) {
  const btn = "rounded-btn px-3 py-1.5 text-sm font-semibold";
  return (
    <div className="flex gap-2">
      <form action={dismissReportsAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <button type="submit" className={`${btn} border border-line text-ink hover:border-brand hover:text-brand`}>
          Dismiss all
        </button>
      </form>
      <form
        action={removeListingAction}
        onSubmit={(e) => { if (!confirm("Remove this listing from the site?")) e.preventDefault(); }}
      >
        <input type="hidden" name="listingId" value={listingId} />
        <button type="submit" className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
          {listingStatus === "deleted" ? "Action reports" : "Remove listing"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/admin/reports/page.tsx`**

```tsx
import Image from "next/image";
import Link from "next/link";
import { requireAdmin, openReportsByListing } from "@/lib/admin";
import { REPORT_REASONS } from "@/lib/validation";
import { formatRelativeTime } from "@/lib/format";
import { getCityLabel } from "@/lib/cities";
import { QueueActions } from "./QueueActions";

export default async function AdminReportsPage() {
  await requireAdmin();
  const groups = await openReportsByListing();

  if (groups.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface-alt px-6 py-12 text-center">
        <p className="font-semibold text-ink">No open reports</p>
        <p className="mt-1 text-sm text-ink-muted">Nothing needs you.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {groups.map((g) => (
        <li key={g.listing.id} className="rounded-card border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-btn bg-surface-alt">
              {g.listing.images[0] && (
                <Image src={g.listing.images[0]} alt="" fill sizes="64px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/listing/${g.listing.id}`} className="font-semibold text-brand hover:underline">
                {g.listing.title}
              </Link>
              <p className="text-xs text-ink-muted">
                {getCityLabel(g.listing.city)} · status: {g.listing.status} · seller:{" "}
                {g.listing.seller.name} ({g.listing.seller.email})
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
              {g.reports.length} {g.reports.length === 1 ? "report" : "reports"}
            </span>
          </div>

          <ul className="mt-3 space-y-2 border-t border-line pt-3">
            {g.reports.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-medium text-ink">{REPORT_REASONS[r.reason] ?? r.reason}</span>
                <span className="text-ink-muted">
                  {" — "}{r.reporterName ?? "Anonymous"} · {formatRelativeTime(r.createdAt)}
                </span>
                {r.details && <p className="mt-0.5 text-ink-muted">&ldquo;{r.details}&rdquo;</p>}
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-line pt-3">
            <QueueActions listingId={g.listing.id} listingStatus={g.listing.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; full `npx vitest run`.

- [ ] **Step 4: Commit**

```powershell
git add app/admin/reports
git commit -m "Add admin reports queue with dismiss and remove"
```

---

### Task 4: Listings search page

**Files:**
- Create: `app/admin/listings/page.tsx`
- Create: `app/admin/listings/RowActions.tsx`

**Interfaces:**
- Consumes: `requireAdmin`, `adminSearchListings`, `AdminListingRow` (Task 1); `removeListingAction`, `restoreListingAction` (Task 2); `formatRelativeTime`.

- [ ] **Step 1: Create `app/admin/listings/RowActions.tsx`** (client)

```tsx
"use client";

import { removeListingAction, restoreListingAction } from "@/app/admin/actions";

export function RowActions({ listingId, status }: { listingId: string; status: string }) {
  const btn = "rounded-btn px-3 py-1.5 text-xs font-semibold";
  if (status === "deleted") {
    return (
      <form action={restoreListingAction}>
        <input type="hidden" name="listingId" value={listingId} />
        <button type="submit" className={`${btn} border border-line text-ink hover:border-brand hover:text-brand`}>
          Restore
        </button>
      </form>
    );
  }
  return (
    <form
      action={removeListingAction}
      onSubmit={(e) => { if (!confirm("Remove this listing from the site?")) e.preventDefault(); }}
    >
      <input type="hidden" name="listingId" value={listingId} />
      <button type="submit" className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
        Remove
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `app/admin/listings/page.tsx`**

```tsx
import Image from "next/image";
import Link from "next/link";
import { requireAdmin, adminSearchListings } from "@/lib/admin";
import { formatRelativeTime } from "@/lib/format";
import { RowActions } from "./RowActions";

const CHIP: Record<string, string> = {
  active: "bg-brand-50 text-brand",
  draft: "border border-line text-ink-muted",
  sold: "bg-surface-alt text-ink-muted",
  expired: "bg-amber-50 text-amber-700",
  deleted: "bg-red-50 text-red-700",
};

export default async function AdminListingsPage({
  searchParams,
}: { searchParams: { q?: string } }) {
  await requireAdmin();
  const q = searchParams.q ?? "";
  const rows = await adminSearchListings(q);

  return (
    <>
      <form action="/admin/listings" method="GET" className="flex gap-2">
        <input
          type="search" name="q" defaultValue={q}
          placeholder="Search by title or seller email…"
          className="h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand"
        />
        <button type="submit" className="h-11 rounded-btn bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
          Search
        </button>
      </form>

      <p className="mt-3 text-xs text-ink-faint">
        {rows.length} {rows.length === 1 ? "result" : "results"}
        {rows.length === 50 ? " (capped at 50 — narrow the search)" : ""} · all statuses included
      </p>

      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 p-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-btn bg-surface-alt">
              {r.images[0] && <Image src={r.images[0]} alt="" fill sizes="48px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/listing/${r.id}`} className="block truncate text-sm font-medium text-brand hover:underline">
                {r.title || "(untitled draft)"}
              </Link>
              <p className="truncate text-xs text-ink-muted">
                {r.seller.email} · {r.views} views · {formatRelativeTime(r.createdAt)} ·{" "}
                <span className="font-mono">{r.id}</span>
              </p>
            </div>
            <span className={`shrink-0 rounded-btn px-2 py-0.5 text-xs font-semibold ${CHIP[r.status] ?? ""}`}>
              {r.status}
            </span>
            <RowActions listingId={r.id} status={r.status} />
          </li>
        ))}
        {rows.length === 0 && <li className="p-6 text-center text-sm text-ink-muted">Nothing matched.</li>}
      </ul>
    </>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit`; full `npx vitest run`.

- [ ] **Step 4: Commit**

```powershell
git add app/admin/listings
git commit -m "Add admin listings search with remove and restore"
```

---

### Task 5: Final verification, docs, deploy (controller-run)

- [ ] **Step 1:** Full suite green; `npx tsc --noEmit`; production build (dev server stopped) then dev restart.
- [ ] **Step 2:** Browser pass with `ADMIN_EMAIL` set in local `.env` to a fixture admin account: overview stats render; reports queue shows a fixture report, Dismiss works, Remove hides listing publicly + actions reports, Restore brings it back; listings search by title and email; a signed-in NON-admin gets 404 on /admin; anonymous gets signin bounce; with `ADMIN_EMAIL` unset (restart), admin gets 404 too (degraded).
- [ ] **Step 3:** README: Phase 4 section (activation = set ADMIN_EMAIL in Vercel to your registered email + redeploy; degraded = no admin surface).
- [ ] **Step 4:** Ledger, final whole-branch review (most capable model), fix wave if needed, merge, push, live verify (/admin → 404 for anonymous-after-bounce…: middleware bounces anonymous to signin; signed-in non-admin 404; with no ADMIN_EMAIL in Vercel yet, everything 404s — verify that), memory update, report with the one-line activation instruction for the user.

---

## Self-review notes

- **Spec coverage:** §1 gating → Task 1 (isAdminEmail/requireAdmin/middleware) + degraded default. §2 overview → Task 2; reports queue incl. deleted-listing "Action reports" label → Task 3; listings search/remove/restore → Task 4. §3 lib → Task 1. §4 testing → Tasks 1 + 5. §6 activation → Task 5 README.
- **Type consistency:** `QueueGroup`/`AdminListingRow` defined Task 1, consumed Tasks 3/4; action names defined Task 2, consumed Tasks 3/4; `REPORT_REASONS` is `Record<string, string>` so `REPORT_REASONS[r.reason]` typechecks.
- **No migration confirmed:** report statuses ("open"/"dismissed"/"actioned") and listing statuses already exist as strings; restore reuses relist semantics.
