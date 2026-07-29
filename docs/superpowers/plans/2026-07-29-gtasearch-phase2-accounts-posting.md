# GTASearch Phase 2 — Accounts & Posting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can register, sign in, post ads through a resumable 6-step wizard with photo upload, and manage their ads from a dashboard.

**Architecture:** NextAuth v4 (credentials + conditional Google) with JWT sessions over the Prisma adapter. The wizard persists a draft `Listing` row (`status: "draft"`) per user; each step is a server-rendered form whose server action validates with Zod and writes to the draft. All mutation logic lives in `lib/` functions that server actions wrap thinly, so the logic is integration-testable without HTTP. Ownership is checked server-side on every mutation.

**Tech Stack:** Next.js 14 App Router, next-auth@4, @next-auth/prisma-adapter, bcryptjs, zod, resend, Cloudinary unsigned upload (client-side fetch), Prisma 6, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-gtasearch-phase2-design.md`. Phase 1 spec invariants remain binding.
- `postalCode` must never reach any client surface except the owner's own wizard/edit forms.
- Every public query keeps filtering `status = 'active' AND expiresAt > now()` — drafts must be invisible everywhere public.
- Degraded modes: missing Google/Cloudinary/Resend env vars must produce the exact behaviours in spec §8 — never a crash, never a fake success.
- Anti-enumeration: register and forgot-password return identical responses whether or not the email exists.
- All prices CAD; design system per Phase 1 (`brand` greens, `rounded-card`/`rounded-btn`, Inter).
- Dev DB is live Supabase. NEVER run `prisma migrate dev` (shadow-DB hang) — use `npm run db:migrate` (create-only) then `npm run db:deploy`. Never run `npm run build` while the dev server is running (shared `.next`).
- Windows/PowerShell environment; run commands from `C:\Users\buruf\Documents\gtasearch`.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Dependencies and environment contract

**Files:**
- Modify: `package.json` (deps via npm install)
- Create: `lib/env.ts`
- Create: `lib/env.test.ts`
- Modify: `.env.example`
- Modify: `.env` (append NEXTAUTH vars — do not touch DATABASE_URL/DIRECT_URL)

**Interfaces:**
- Produces: `googleEnabled(): boolean`, `resendEnabled(): boolean`, `cloudinaryConfig(): { cloudName: string; uploadPreset: string } | null`, `appUrl(): string`

- [ ] **Step 1: Install dependencies**

```powershell
npm install next-auth@^4.24.13 @next-auth/prisma-adapter@^1.0.7 bcryptjs@^3.0.4 zod@^3.25.0 resend@^4.6.0
```

Expected: exit 0, packages added to `package.json`.

- [ ] **Step 2: Write failing test for env helpers**

`lib/env.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { googleEnabled, resendEnabled, cloudinaryConfig, appUrl } from "@/lib/env";

const saved = { ...process.env };
beforeEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_UPLOAD_PRESET;
  delete process.env.NEXTAUTH_URL;
});
afterAll(() => { Object.assign(process.env, saved); });

describe("env degraded-mode helpers", () => {
  it("googleEnabled needs BOTH id and secret", () => {
    expect(googleEnabled()).toBe(false);
    process.env.GOOGLE_CLIENT_ID = "x";
    expect(googleEnabled()).toBe(false);
    process.env.GOOGLE_CLIENT_SECRET = "y";
    expect(googleEnabled()).toBe(true);
  });

  it("cloudinaryConfig returns null unless both vars set", () => {
    expect(cloudinaryConfig()).toBeNull();
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    expect(cloudinaryConfig()).toBeNull();
    process.env.CLOUDINARY_UPLOAD_PRESET = "unsigned1";
    expect(cloudinaryConfig()).toEqual({ cloudName: "demo", uploadPreset: "unsigned1" });
  });

  it("resendEnabled reflects RESEND_API_KEY", () => {
    expect(resendEnabled()).toBe(false);
    process.env.RESEND_API_KEY = "re_123";
    expect(resendEnabled()).toBe(true);
  });

  it("appUrl falls back to localhost dev port", () => {
    expect(appUrl()).toBe("http://localhost:3020");
    process.env.NEXTAUTH_URL = "https://gtasearch.com";
    expect(appUrl()).toBe("https://gtasearch.com");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run lib/env.test.ts`
Expected: FAIL — cannot resolve `@/lib/env`.

- [ ] **Step 4: Implement `lib/env.ts`**

```ts
// Degraded-mode contract (spec §8): every external service is optional until
// its keys arrive. These helpers are the single source of truth for "is this
// service configured" — UI and actions must never read the raw vars directly.

export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function resendEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function cloudinaryConfig(): { cloudName: string; uploadPreset: string } | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) return null;
  return { cloudName, uploadPreset };
}

export function appUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3020";
}
```

- [ ] **Step 5: Run test to verify pass**

Run: `npx vitest run lib/env.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 6: Update `.env.example`** — replace the whole file with:

```
# ---- Required (Phase 1) ----
# Supabase transaction pooler (port 6543) — application runtime
DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
# Supabase session pooler (port 5432) — migrations and seed only
DIRECT_URL="postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"

# ---- Required (Phase 2) ----
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3020

# ---- Optional until keys arrive (app degrades gracefully; spec §8) ----
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_UPLOAD_PRESET=
RESEND_API_KEY=
EMAIL_FROM="GTASearch <noreply@gtasearch.com>"
```

- [ ] **Step 7: Append to the real `.env`** (PowerShell, keeps existing lines):

```powershell
$secret = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Add-Content .env "`nNEXTAUTH_SECRET=$secret`nNEXTAUTH_URL=http://localhost:3020"
```

- [ ] **Step 8: Commit**

```powershell
git add package.json package-lock.json lib/env.ts lib/env.test.ts .env.example
git commit -m "Add Phase 2 dependencies and degraded-mode env contract"
```

---

### Task 2: Schema migration — auth tables, reset tokens, draft status

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_phase2_auth/migration.sql` (generated, then hand-edited)

**Interfaces:**
- Produces: models `Account`, `Session`, `VerificationToken`, `PasswordResetToken`; `User.emailVerified`; partial unique index `Listing_one_draft_per_user`; `Listing.status` may now be `"draft"`.

- [ ] **Step 1: Edit `prisma/schema.prisma`**

In `model User`, after `createdAt`, add:

```prisma
  emailVerified DateTime?

  accounts            Account[]
  sessions            Session[]
  passwordResetTokens PasswordResetToken[]
```

Update the `Listing.status` comment to `// "draft" | "active" | "sold" | "expired" | "deleted"`.

Append at the end of the file:

```prisma
// ---- NextAuth adapter tables (JWT strategy: Session stays empty but the
// adapter requires it; keeping it future-proofs a move to DB sessions). ----

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Forgot-password tokens. Only the SHA-256 hash is stored; the raw token
// exists solely inside the emailed link. Single-use via usedAt.
model PasswordResetToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Generate migration (create-only — NEVER `migrate dev`)**

```powershell
npm run db:migrate -- --name phase2_auth
```

Expected: new folder under `prisma/migrations/`, not applied.

- [ ] **Step 3: Hand-edit the generated `migration.sql`** — append at the end:

```sql
-- One draft per user. Prisma cannot declare partial indexes; hand-added here.
-- A DB guarantee beats an application check: the wizard has several entry points.
CREATE UNIQUE INDEX "Listing_one_draft_per_user"
  ON "Listing"("userId") WHERE status = 'draft';
```

- [ ] **Step 4: Apply and regenerate client**

```powershell
npm run db:deploy
npx prisma generate
```

Expected: `1 migration applied`, client regenerated without errors.

- [ ] **Step 5: Verify the partial index enforces**

```powershell
npx tsx -e "import { db } from './lib/db'; (async () => { const u = await db.user.findFirst(); const mk = () => db.listing.create({ data: { title: '', description: '', category: '', city: '', images: [], status: 'draft', expiresAt: new Date(Date.now()+86400000*30), userId: u!.id } }); const a = await mk(); let dup = false; try { await mk(); dup = true; } catch { console.log('duplicate draft correctly rejected'); } await db.listing.delete({ where: { id: a.id } }); if (dup) throw new Error('PARTIAL INDEX NOT ENFORCING'); })().finally(() => db.$disconnect());"
```

Expected: `duplicate draft correctly rejected`.

- [ ] **Step 6: Run existing suite to prove nothing regressed**

Run: `npx vitest run` — Expected: all pre-existing tests still pass.

- [ ] **Step 7: Commit**

```powershell
git add prisma
git commit -m "Add auth tables, password reset tokens, and one-draft-per-user index"
```

---

### Task 3: Rate limiter

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `lib/rate-limit.test.ts`

**Interfaces:**
- Produces: `rateLimit(key: string, limit: number, windowMs: number, now?: number): boolean` (true = allowed), `resetRateLimiter(): void` (tests only).

- [ ] **Step 1: Write failing tests**

`lib/rate-limit.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimiter } from "@/lib/rate-limit";

beforeEach(() => resetRateLimiter());

describe("rateLimit", () => {
  it("allows up to the limit then refuses", () => {
    const t = 1_000_000;
    expect(rateLimit("k", 3, 60_000, t)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 1)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 2)).toBe(true);
    expect(rateLimit("k", 3, 60_000, t + 3)).toBe(false);
  });

  it("window slides: old hits expire", () => {
    const t = 1_000_000;
    rateLimit("k", 2, 1_000, t);
    rateLimit("k", 2, 1_000, t + 10);
    expect(rateLimit("k", 2, 1_000, t + 20)).toBe(false);
    expect(rateLimit("k", 2, 1_000, t + 1_011)).toBe(true);
  });

  it("keys are independent", () => {
    const t = 1_000_000;
    expect(rateLimit("a", 1, 60_000, t)).toBe(true);
    expect(rateLimit("b", 1, 60_000, t)).toBe(true);
    expect(rateLimit("a", 1, 60_000, t + 1)).toBe(false);
  });

  it("a refused call does not consume quota", () => {
    const t = 1_000_000;
    rateLimit("k", 1, 1_000, t);
    rateLimit("k", 1, 1_000, t + 1); // refused
    expect(rateLimit("k", 1, 1_000, t + 1_001)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/rate-limit.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/rate-limit.ts`**

```ts
// In-memory sliding-window limiter. Per-instance only — the same acknowledged
// stopgap as eduyro's; Redis/Upstash is the known upgrade path. Good enough to
// blunt casual abuse of register / forgot-password / publish.

const buckets = new Map<string, number[]>();
const MAX_KEYS = 10_000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }

  hits.push(now);
  buckets.set(key, hits);

  // TTL eviction so the map cannot grow without bound.
  if (buckets.size > MAX_KEYS) {
    for (const [k, v] of buckets) {
      if (v.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }
  return true;
}

export function resetRateLimiter(): void {
  buckets.clear();
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/rate-limit.test.ts` → PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/rate-limit.ts lib/rate-limit.test.ts
git commit -m "Add in-memory sliding-window rate limiter"
```

---

### Task 4: Moderation (banned words)

**Files:**
- Create: `lib/moderation.ts`
- Create: `lib/moderation.test.ts`

**Interfaces:**
- Produces: `violatesModeration(text: string): boolean`

- [ ] **Step 1: Write failing tests**

`lib/moderation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { violatesModeration } from "@/lib/moderation";

describe("violatesModeration", () => {
  it("flags a banned word", () => {
    expect(violatesModeration("cheap cocaine for sale")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(violatesModeration("Buy COCAINE now")).toBe(true);
  });
  it("catches simple leet-speak", () => {
    expect(violatesModeration("selling c0ca1ne cheap")).toBe(true);
  });
  it("respects word boundaries — 'class' must not trip 'ass'", () => {
    expect(violatesModeration("world class sofa in great condition")).toBe(false);
  });
  it("'Scunthorpe'-style substrings do not trip", () => {
    expect(violatesModeration("vintage assorted glassware")).toBe(false);
  });
  it("clean text passes", () => {
    expect(violatesModeration("Brown leather sectional sofa, excellent condition")).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/moderation.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/moderation.ts`**

```ts
// Simple banned-words moderation, checked at publish (spec §4). Matching is
// word-boundary on a leet-normalised copy, so "c0ca1ne" trips but "class"
// and "assorted" never do. Rejections are generic — the caller must NOT echo
// which word matched.

const BANNED = [
  "cocaine", "heroin", "fentanyl", "meth", "mdma", "ecstasy",
  "counterfeit", "replica watches", "stolen",
  "escort", "sex", "porn", "nude",
  "glock", "pistol", "rifle", "ammunition", "silencer",
  "ass", "fuck", "shit", "bitch", "cunt",
];

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
};

function normalise(text: string): string {
  return text.toLowerCase().replace(/[013457@$]/g, (c) => LEET[c] ?? c);
}

const PATTERNS = BANNED.map(
  (w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
);

export function violatesModeration(text: string): boolean {
  const n = normalise(text);
  return PATTERNS.some((p) => p.test(n));
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/moderation.test.ts` → PASS (6 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/moderation.ts lib/moderation.test.ts
git commit -m "Add banned-words moderation with leet normalisation"
```

---

### Task 5: Validation schemas

**Files:**
- Create: `lib/validation.ts`
- Create: `lib/validation.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES`, `getCategory` from `@/lib/categories`; `getCity` from `@/lib/cities`.
- Produces: Zod schemas `RegisterSchema`, `CategoryStepSchema`, `DetailsStepSchema`, `LocationStepSchema`, `PhotosStepSchema`, `ChangePasswordSchema`, `ProfileSchema`, plus `cloudinaryUrlPattern(cloudName): RegExp`.

- [ ] **Step 1: Write failing tests**

`lib/validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  RegisterSchema, DetailsStepSchema, LocationStepSchema, PhotosStepSchema,
} from "@/lib/validation";

describe("RegisterSchema", () => {
  const ok = { firstName: "Amina", lastName: "Hassan", email: "A@B.co", password: "longenough", confirm: "longenough" };
  it("accepts valid input and lowercases email", () => {
    const r = RegisterSchema.parse(ok);
    expect(r.email).toBe("a@b.co");
  });
  it("rejects mismatched confirm", () => {
    expect(RegisterSchema.safeParse({ ...ok, confirm: "different1" }).success).toBe(false);
  });
  it("rejects short password", () => {
    expect(RegisterSchema.safeParse({ ...ok, password: "short", confirm: "short" }).success).toBe(false);
  });
});

describe("DetailsStepSchema", () => {
  const ok = { title: "Solid oak table", description: "A perfectly good table, six chairs included.", priceType: "fixed", price: "575" };
  it("accepts valid fixed-price input, coercing price", () => {
    const r = DetailsStepSchema.parse(ok);
    expect(r.price).toBe(575);
  });
  it("requires price when priceType is fixed", () => {
    expect(DetailsStepSchema.safeParse({ ...ok, price: "" }).success).toBe(false);
  });
  it("nulls price when priceType is free", () => {
    const r = DetailsStepSchema.parse({ ...ok, priceType: "free", price: "999" });
    expect(r.price).toBeNull();
  });
  it("rejects negative and absurd prices", () => {
    expect(DetailsStepSchema.safeParse({ ...ok, price: "-5" }).success).toBe(false);
    expect(DetailsStepSchema.safeParse({ ...ok, price: "10000000" }).success).toBe(false);
  });
  it("rejects title over 80 chars and description under 20", () => {
    expect(DetailsStepSchema.safeParse({ ...ok, title: "x".repeat(81) }).success).toBe(false);
    expect(DetailsStepSchema.safeParse({ ...ok, description: "too short" }).success).toBe(false);
  });
});

describe("LocationStepSchema", () => {
  it("accepts a known city slug", () => {
    expect(LocationStepSchema.safeParse({ city: "toronto", neighbourhood: "", postalCode: "" }).success).toBe(true);
  });
  it("rejects an unknown city", () => {
    expect(LocationStepSchema.safeParse({ city: "winnipeg", neighbourhood: "", postalCode: "" }).success).toBe(false);
  });
  it("accepts a valid Canadian postal code and rejects garbage", () => {
    expect(LocationStepSchema.safeParse({ city: "ajax", neighbourhood: "", postalCode: "L1S 3V4" }).success).toBe(true);
    expect(LocationStepSchema.safeParse({ city: "ajax", neighbourhood: "", postalCode: "12345" }).success).toBe(false);
  });
});

describe("PhotosStepSchema", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => `https://res.cloudinary.com/demo/image/upload/v1/x${i}.jpg`);
  it("accepts up to 10 cloudinary URLs on our cloud", () => {
    expect(PhotosStepSchema("demo").safeParse({ images: mk(10) }).success).toBe(true);
  });
  it("rejects 11 images", () => {
    expect(PhotosStepSchema("demo").safeParse({ images: mk(11) }).success).toBe(false);
  });
  it("rejects URLs from another cloud or host", () => {
    expect(PhotosStepSchema("demo").safeParse({ images: ["https://res.cloudinary.com/evil/image/upload/x.jpg"] }).success).toBe(false);
    expect(PhotosStepSchema("demo").safeParse({ images: ["https://example.com/x.jpg"] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/validation.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/validation.ts`**

```ts
import { z } from "zod";
import { getCategory } from "@/lib/categories";
import { getCity } from "@/lib/cities";

// All server actions validate through these schemas. HTML client validation is
// a convenience only; these are the real gate.

export const RegisterSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(50),
    lastName: z.string().trim().min(1, "Last name is required").max(50),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export const CategoryStepSchema = z
  .object({
    category: z.string(),
    subcategory: z.string().optional().default(""),
  })
  .superRefine((d, ctx) => {
    const cat = getCategory(d.category);
    if (!cat) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Pick a category" });
      return;
    }
    if (d.subcategory && !cat.subcategories.some((s) => s.slug === d.subcategory)) {
      ctx.addIssue({ code: "custom", path: ["subcategory"], message: "Pick a valid subcategory" });
    }
  });

export const DetailsStepSchema = z
  .object({
    title: z.string().trim().min(4, "Title is too short").max(80, "Max 80 characters"),
    description: z.string().trim().min(20, "Describe your item in at least 20 characters").max(2000),
    priceType: z.enum(["fixed", "free", "contact", "trade"]),
    price: z.string().optional().default(""),
  })
  .transform((d, ctx) => {
    if (d.priceType !== "fixed") return { ...d, price: null as number | null };
    const n = Number(d.price);
    if (d.price === "" || !Number.isFinite(n) || n < 0 || n > 9_999_999) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price between $0 and $9,999,999" });
      return z.NEVER;
    }
    return { ...d, price: Math.round(n * 100) / 100 };
  });

export const LocationStepSchema = z.object({
  city: z.string().refine((s) => Boolean(getCity(s)), "Pick a city from the list"),
  neighbourhood: z.string().trim().max(80).optional().default(""),
  postalCode: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .default("")
    .refine((s) => s === "" || /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(s), "Enter a valid postal code (e.g. M5V 2T6)"),
});

export function cloudinaryUrlPattern(cloudName: string): RegExp {
  const esc = cloudName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^https://res\\.cloudinary\\.com/${esc}/image/upload/`);
}

export const PhotosStepSchema = (cloudName: string) =>
  z.object({
    images: z
      .array(z.string().regex(cloudinaryUrlPattern(cloudName), "Invalid image URL"))
      .max(10, "Maximum 10 photos"),
  });

export const ChangePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "New password must be at least 8 characters").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const ProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((s) => s === "" || /^[\d\s()+-]{7,20}$/.test(s), "Enter a valid phone number"),
});
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/validation.test.ts` → PASS (12 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/validation.ts lib/validation.test.ts
git commit -m "Add Zod validation schemas for auth and wizard steps"
```

---

### Task 6: Auth core — NextAuth config, registration, sign-in pages, header

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/users.ts`
- Create: `lib/users.integration.test.ts`
- Create: `types/next-auth.d.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`
- Create: `app/auth/actions.ts`
- Create: `components/AuthForms.tsx`
- Create: `app/auth/signin/page.tsx`
- Create: `app/auth/register/page.tsx`
- Create: `components/UserMenu.tsx`
- Modify: `components/Header.tsx` (swap static Sign In links for session-aware menu)

**Interfaces:**
- Consumes: `db`, `RegisterSchema`, `rateLimit`, `googleEnabled`.
- Produces: `authOptions: NextAuthOptions`; `requireUserId(): Promise<string>` (redirects to signin when anonymous); `createUser(input): Promise<{ ok: true }>` (identical result whether or not email exists — anti-enumeration); `registerAction(prevState, formData)` server action; session shape `session.user.id: string`.

- [ ] **Step 1: Write failing integration test for `createUser`**

`lib/users.integration.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createUser, verifyPassword } from "@/lib/users";

const EMAIL = `vitest-phase2-${Date.now()}@example.com`;

afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

describe("createUser", () => {
  it("creates a user with a bcrypt hash, never storing the raw password", async () => {
    const r = await createUser({ firstName: "Test", lastName: "User", email: EMAIL, password: "hunter2hunter2" });
    expect(r.ok).toBe(true);
    const u = await db.user.findUnique({ where: { email: EMAIL } });
    expect(u).not.toBeNull();
    expect(u!.name).toBe("Test User");
    expect(u!.passwordHash).not.toContain("hunter2");
    expect(await verifyPassword("hunter2hunter2", u!.passwordHash!)).toBe(true);
    expect(await verifyPassword("wrong-password", u!.passwordHash!)).toBe(false);
  });

  it("returns the identical success shape for a duplicate email (anti-enumeration)", async () => {
    const r = await createUser({ firstName: "Dup", lastName: "User", email: EMAIL, password: "differentpass1" });
    expect(r).toEqual({ ok: true });
    const count = await db.user.count({ where: { email: EMAIL } });
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/users.integration.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/users.ts`**

```ts
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const BCRYPT_COST = 12;

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Registers a user. Returns { ok: true } whether or not the email was already
 * taken — the caller must not be able to distinguish (anti-enumeration; the
 * same class of leak fixed in the eduyro audit). The duplicate attempt simply
 * creates nothing.
 */
export async function createUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  const passwordHash = await hashPassword(input.password);
  try {
    await db.user.create({
      data: {
        email: input.email,
        name: `${input.firstName} ${input.lastName}`.trim(),
        passwordHash,
      },
    });
  } catch (e: unknown) {
    // P2002 = unique violation on email. Swallow deliberately.
    const code = (e as { code?: string }).code;
    if (code !== "P2002") throw e;
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/users.integration.test.ts` → PASS (2 tests).

- [ ] **Step 5: Implement `lib/auth.ts`**

```ts
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/users";
import { googleEnabled } from "@/lib/env";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  // JWT because the credentials provider cannot use database sessions.
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;
        const user = await db.user.findUnique({ where: { email } });
        // Same null (→ same generic error) for unknown email and wrong
        // password: sign-in must not confirm which emails have accounts.
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        return ok ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
    // Keys-later: with no Google env vars, the provider (and its button) simply
    // does not exist. Spec §1/§8.
    ...(googleEnabled()
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

/** For server components/actions on protected routes: session or bounce. */
export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");
  return session.user.id;
}

export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
```

- [ ] **Step 6: Create `types/next-auth.d.ts`**

```ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
```

- [ ] **Step 7: Create `app/api/auth/[...nextauth]/route.ts`**

```ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

- [ ] **Step 8: Create `middleware.ts`** (project root)

```ts
import { withAuth } from "next-auth/middleware";

// Protects authenticated areas; anonymous users bounce to sign-in with a
// callbackUrl back to where they were headed.
export default withAuth({ pages: { signIn: "/auth/signin" } });

export const config = {
  matcher: ["/post-ad/:path*", "/post-ad", "/dashboard/:path*", "/dashboard", "/listing/:id/edit"],
};
```

- [ ] **Step 9: Create `app/auth/actions.ts`**

```ts
"use server";

import { headers } from "next/headers";
import { RegisterSchema } from "@/lib/validation";
import { createUser } from "@/lib/users";
import { rateLimit } from "@/lib/rate-limit";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function clientIp(): string {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(`register:${clientIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many attempts. Please try again later." };
  }

  const parsed = RegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors };
  }

  await createUser(parsed.data);
  // Identical response whether the email was new or taken (anti-enumeration).
  return { ok: true };
}
```

- [ ] **Step 10: Create `components/AuthForms.tsx`** (client component — tabbed sign-in/register)

```tsx
"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { registerAction, type FormState } from "@/app/auth/actions";

const input = "h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
const label = "mt-3 block text-sm font-medium text-ink";
const button = "mt-5 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={button}>{pending ? "Please wait…" : children}</button>;
}

export function AuthForms({ tab, googleOn }: { tab: "signin" | "register"; googleOn: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [signinError, setSigninError] = useState<string | null>(null);
  const [state, formAction] = useFormState<FormState, FormData>(registerAction, { ok: false });

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: f.get("email"), password: f.get("password"), redirect: false,
    });
    if (res?.error) setSigninError("Incorrect email or password.");
    else router.push(callbackUrl);
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-btn py-2 text-center text-sm font-semibold ${active ? "bg-brand text-white" : "text-ink-muted hover:text-ink"}`;

  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
      <div className="flex gap-1 rounded-btn bg-surface-alt p-1">
        <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={tabClass(tab === "signin")}>Sign In</Link>
        <Link href={`/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={tabClass(tab === "register")}>Register</Link>
      </div>

      {tab === "signin" ? (
        <form onSubmit={onSignIn} className="mt-4">
          <label className={label} htmlFor="si-email">Email</label>
          <input id="si-email" name="email" type="email" required autoComplete="email" className={input} />
          <label className={label} htmlFor="si-password">Password</label>
          <input id="si-password" name="password" type="password" required autoComplete="current-password" className={input} />
          {signinError && <p role="alert" className="mt-3 text-sm text-red-600">{signinError}</p>}
          <Submit>Sign in</Submit>
          <p className="mt-3 text-center text-sm">
            <Link href="/auth/forgot" className="text-brand hover:underline">Forgot password?</Link>
          </p>
        </form>
      ) : state.ok ? (
        <div className="mt-6 text-center">
          <p className="font-semibold text-ink">Check your details and sign in</p>
          <p className="mt-2 text-sm text-ink-muted">
            If that email was available, your account is ready — sign in with your new password.
          </p>
          <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
            Go to sign in
          </Link>
        </div>
      ) : (
        <form action={formAction} className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="firstName">First name</label>
              <input id="firstName" name="firstName" required maxLength={50} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="lastName">Last name</label>
              <input id="lastName" name="lastName" required maxLength={50} className={input} />
            </div>
          </div>
          <label className={label} htmlFor="re-email">Email</label>
          <input id="re-email" name="email" type="email" required autoComplete="email" className={input} />
          <label className={label} htmlFor="re-password">Password</label>
          <input id="re-password" name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
          <label className={label} htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" required className={input} />
          {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
          {state.fieldErrors && Object.values(state.fieldErrors).map((m) => (
            <p key={m} role="alert" className="mt-1 text-sm text-red-600">{m}</p>
          ))}
          <Submit>Create account</Submit>
        </form>
      )}

      {googleOn && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={() => signIn("google", { callbackUrl })} className="h-11 w-full rounded-btn border border-line text-sm font-semibold text-ink hover:border-brand">
            Continue with Google
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 11: Create the two pages**

`app/auth/signin/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForms } from "@/components/AuthForms";
import { googleEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <div className="px-4 pb-16">
      <Suspense>
        <AuthForms tab="signin" googleOn={googleEnabled()} />
      </Suspense>
    </div>
  );
}
```

`app/auth/register/page.tsx` — identical except `metadata.title = "Create an account"` and `tab="register"`.

- [ ] **Step 12: Create `components/UserMenu.tsx`** and wire the header

```tsx
"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const first = name.split(" ")[0];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="rounded-btn px-3 py-2 text-sm font-medium text-ink hover:bg-surface-alt">
        {first} ▾
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-card border border-line bg-surface py-1 shadow-card-hover">
          <Link href="/dashboard" className="block px-4 py-2 text-sm text-ink hover:bg-surface-alt" onClick={() => setOpen(false)}>Dashboard</Link>
          <button type="button" onClick={() => signOut({ callbackUrl: "/" })}
            className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-alt">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
```

In `components/Header.tsx`: make it async, fetch the session, and replace the two static links:

```tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SearchBar } from "@/components/SearchBar";
import { UserMenu } from "@/components/UserMenu";

export async function Header() {
  const session = await getServerSession(authOptions);
  // ... existing wrapper markup unchanged ...
  // In the right-hand action block, replace the old Sign In link with:
  //   {session?.user
  //     ? <UserMenu name={session.user.name ?? "Account"} />
  //     : <Link href="/auth/signin" className="hidden rounded-btn px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink sm:block">Sign In</Link>}
  // and change the Post Ad link's href from "/coming-soon" to "/post-ad".
}
```

(Keep every other line of the existing Header exactly as-is.)

- [ ] **Step 13: Browser-verify auth end to end**

Start dev server (`preview_start gtasearch`), then:
1. `/auth/register` → create `test.user+p2@example.com` / `password123`. Expect the neutral "check your details" panel.
2. Register the same email again → identical panel (anti-enumeration visible in UI).
3. `/auth/signin` → wrong password → generic "Incorrect email or password."; right password → lands on `/dashboard` (404 for now — Task 10 builds it; a 404 behind auth is acceptable at this checkpoint).
4. Header shows first name + menu; Sign out returns to homepage as anonymous.
5. Anonymous visit to `/post-ad` → bounced to `/auth/signin?callbackUrl=%2Fpost-ad`.
6. No Google button appears (no keys configured).

- [ ] **Step 14: Run full suite + commit**

```powershell
npx vitest run
git add lib/auth.ts lib/users.ts lib/users.integration.test.ts types app/api/auth app/auth components/AuthForms.tsx components/UserMenu.tsx components/Header.tsx middleware.ts
git commit -m "Add NextAuth credentials auth, registration, and session-aware header"
```

---

### Task 7: Password reset (tokens + Resend + pages)

**Files:**
- Create: `lib/tokens.ts`
- Create: `lib/tokens.integration.test.ts`
- Create: `lib/email.ts`
- Create: `app/auth/forgot/page.tsx`
- Create: `app/auth/reset/[token]/page.tsx`
- Modify: `app/auth/actions.ts` (add `forgotAction`, `resetAction`)

**Interfaces:**
- Consumes: `db`, `hashPassword`, `rateLimit`, `resendEnabled`, `appUrl`.
- Produces: `createResetToken(userId): Promise<string>` (returns RAW token; stores only hash, 1h expiry); `consumeResetToken(raw): Promise<string | null>` (returns userId once, null on expired/used/unknown); `sendPasswordResetEmail(to, url): Promise<boolean>`.

- [ ] **Step 1: Write failing integration tests**

`lib/tokens.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createResetToken, consumeResetToken } from "@/lib/tokens";

let userId: string;
const EMAIL = `vitest-tokens-${Date.now()}@example.com`;

beforeAll(async () => {
  const u = await db.user.create({ data: { email: EMAIL, name: "Token Test" } });
  userId = u.id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

describe("reset tokens", () => {
  it("round-trips: create then consume returns the userId", async () => {
    const raw = await createResetToken(userId);
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    const stored = await db.passwordResetToken.findFirst({ where: { userId } });
    expect(stored!.tokenHash).not.toBe(raw); // only the hash is stored
    expect(await consumeResetToken(raw)).toBe(userId);
  });

  it("is single-use", async () => {
    const raw = await createResetToken(userId);
    expect(await consumeResetToken(raw)).toBe(userId);
    expect(await consumeResetToken(raw)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const raw = await createResetToken(userId);
    await db.passwordResetToken.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await consumeResetToken(raw)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await consumeResetToken("not-a-token")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/tokens.integration.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/tokens.ts`**

```ts
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Creates a reset token; returns the RAW token for the email link. Only the
 *  SHA-256 hash is persisted, so a database leak cannot forge reset links. */
export async function createResetToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { tokenHash: sha256(raw), userId, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return raw;
}

/** Consumes a raw token exactly once. Returns the userId, or null for
 *  unknown / expired / already-used tokens (indistinguishably). */
export async function consumeResetToken(raw: string): Promise<string | null> {
  const { count } = await db.passwordResetToken.updateMany({
    where: { tokenHash: sha256(raw), usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count === 0) return null;
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(raw) } });
  return row?.userId ?? null;
}

/** Invalidate all outstanding tokens (on successful reset / password change). */
export async function invalidateResetTokens(userId: string): Promise<void> {
  await db.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/tokens.integration.test.ts` → PASS (4 tests).

- [ ] **Step 5: Implement `lib/email.ts`**

```ts
import { Resend } from "resend";
import { resendEnabled } from "@/lib/env";

/** Returns false when email is unconfigured (degraded mode) or sending fails.
 *  Callers surface "email isn't configured" honestly — never a fake success. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!resendEnabled()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "GTASearch <onboarding@resend.dev>",
      to,
      subject: "Reset your GTASearch password",
      text: `Someone requested a password reset for your GTASearch account.\n\nReset it here (link valid for 1 hour):\n${resetUrl}\n\nIf this wasn't you, ignore this email — your password is unchanged.`,
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Add actions to `app/auth/actions.ts`**

```ts
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createResetToken, consumeResetToken, invalidateResetTokens } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { hashPassword } from "@/lib/users";
import { resendEnabled, appUrl } from "@/lib/env";
import { z } from "zod";

export async function forgotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!resendEnabled()) {
    return { ok: false, error: "Password reset email isn't configured yet. Please contact support." };
  }
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: "Enter a valid email address." };
  if (!rateLimit(`forgot:${email.data}`, 3, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many reset requests. Please try again later." };
  }

  const user = await db.user.findUnique({ where: { email: email.data } });
  if (user) {
    const raw = await createResetToken(user.id);
    await sendPasswordResetEmail(user.email, `${appUrl()}/auth/reset/${raw}`);
  }
  // Identical response whether or not the account exists.
  return { ok: true };
}

const ResetSchema = z
  .object({ token: z.string().min(1), password: z.string().min(8).max(100), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export async function resetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const userId = await consumeResetToken(parsed.data.token);
  if (!userId) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };

  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await invalidateResetTokens(userId);
  redirect("/auth/signin?reset=1");
}
```

- [ ] **Step 7: Create the two pages** (small client forms using `useFormState`, same styling constants as `AuthForms`)

`app/auth/forgot/page.tsx`: heading "Reset your password", one email input, submits `forgotAction`. On `state.ok`, replace the form with: "If an account exists for that address, a reset link is on its way. Check your inbox." On `state.error`, show it in red.

`app/auth/reset/[token]/page.tsx`: heading "Choose a new password", hidden input `name="token"` carrying `params.token`, password + confirm inputs, submits `resetAction`; errors shown in red.

Both pages: `robots: { index: false }`, wrapped in the same `max-w-md` card as `AuthForms`, forms are client components (`"use client"` file-level split like `AuthForms` if needed).

- [ ] **Step 8: Browser-verify degraded mode** — `/auth/forgot` with no `RESEND_API_KEY` must show "Password reset email isn't configured yet", NOT a fake success.

- [ ] **Step 9: Full suite + commit**

```powershell
npx vitest run
git add lib/tokens.ts lib/tokens.integration.test.ts lib/email.ts app/auth
git commit -m "Add hashed single-use password reset with honest degraded mode"
```

---

### Task 8: Draft lifecycle and step gates

**Files:**
- Create: `lib/draft.ts`
- Create: `lib/draft.test.ts` (pure gate logic)
- Create: `lib/draft.integration.test.ts` (DB behaviour)

**Interfaces:**
- Consumes: `db`.
- Produces:
  - `type WizardStep = "category" | "details" | "location" | "photos" | "boost" | "review"`
  - `STEP_ORDER: WizardStep[]`, `stepPath(step: WizardStep): string`
  - `firstIncompleteStep(d: { category: string; title: string; description: string; city: string }): WizardStep` (pure)
  - `getDraft(userId): Promise<Listing | null>`, `getOrCreateDraft(userId): Promise<Listing>`, `discardDraft(userId): Promise<void>`, `sweepStaleDrafts(userId): Promise<void>` (deletes this user's drafts older than 7 days)

- [ ] **Step 1: Write failing pure tests**

`lib/draft.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { firstIncompleteStep, stepPath } from "@/lib/draft";

const base = { category: "electronics", title: "iPhone 13 Pro unlocked", description: "Great condition, 256GB, battery 89%, includes box.", city: "toronto" };

describe("firstIncompleteStep", () => {
  it("empty draft → category", () => {
    expect(firstIncompleteStep({ category: "", title: "", description: "", city: "" })).toBe("category");
  });
  it("category done, no details → details", () => {
    expect(firstIncompleteStep({ ...base, title: "", description: "" })).toBe("details");
  });
  it("details too short still → details", () => {
    expect(firstIncompleteStep({ ...base, title: "abc", description: "short" })).toBe("details");
  });
  it("no city → location", () => {
    expect(firstIncompleteStep({ ...base, city: "" })).toBe("location");
  });
  it("complete draft → review (photos and boost are optional)", () => {
    expect(firstIncompleteStep(base)).toBe("review");
  });
});

describe("stepPath", () => {
  it("category is the wizard root; others are subroutes", () => {
    expect(stepPath("category")).toBe("/post-ad");
    expect(stepPath("review")).toBe("/post-ad/review");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/draft.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/draft.ts`**

```ts
import type { Listing } from "@prisma/client";
import { db } from "@/lib/db";

export type WizardStep = "category" | "details" | "location" | "photos" | "boost" | "review";

export const STEP_ORDER: WizardStep[] = ["category", "details", "location", "photos", "boost", "review"];

export function stepPath(step: WizardStep): string {
  return step === "category" ? "/post-ad" : `/post-ad/${step}`;
}

/**
 * The single source of truth for wizard gating (spec §4): every step's page
 * and action recompute this server-side, so URL-jumping to /review with an
 * empty draft always bounces to the first incomplete step. Photos and boost
 * are optional, so a draft with category+details+location is review-ready.
 * Thresholds mirror DetailsStepSchema (title ≥4, description ≥20).
 */
export function firstIncompleteStep(d: {
  category: string;
  title: string;
  description: string;
  city: string;
}): WizardStep {
  if (!d.category) return "category";
  if (d.title.trim().length < 4 || d.description.trim().length < 20) return "details";
  if (!d.city) return "location";
  return "review";
}

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function sweepStaleDrafts(userId: string): Promise<void> {
  await db.listing.deleteMany({
    where: { userId, status: "draft", createdAt: { lt: new Date(Date.now() - DRAFT_TTL_MS) } },
  });
}

export async function getDraft(userId: string): Promise<Listing | null> {
  await sweepStaleDrafts(userId);
  return db.listing.findFirst({ where: { userId, status: "draft" } });
}

export async function getOrCreateDraft(userId: string): Promise<Listing> {
  const existing = await getDraft(userId);
  if (existing) return existing;
  return db.listing.create({
    data: {
      title: "", description: "", category: "", city: "",
      images: [], status: "draft", priceType: "fixed",
      // Placeholder; publish recomputes it as now + 30 days.
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      userId,
    },
  });
}

export async function discardDraft(userId: string): Promise<void> {
  await db.listing.deleteMany({ where: { userId, status: "draft" } });
}
```

- [ ] **Step 4: Run pure tests** — `npx vitest run lib/draft.test.ts` → PASS (7 tests).

- [ ] **Step 5: Write + run integration test**

`lib/draft.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getDraft, getOrCreateDraft, discardDraft } from "@/lib/draft";
import { searchListings, parseSearchParams } from "@/lib/search";

let userId: string;
const EMAIL = `vitest-draft-${Date.now()}@example.com`;

beforeAll(async () => {
  const u = await db.user.create({ data: { email: EMAIL, name: "Draft Test" } });
  userId = u.id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } }); // cascades to draft
  await db.$disconnect();
});

describe("draft lifecycle", () => {
  it("getOrCreateDraft is idempotent — one draft per user", async () => {
    const a = await getOrCreateDraft(userId);
    const b = await getOrCreateDraft(userId);
    expect(b.id).toBe(a.id);
    expect(a.status).toBe("draft");
  });

  it("drafts are invisible to public search even with matching text", async () => {
    await db.listing.updateMany({
      where: { userId, status: "draft" },
      data: { title: "zzduniquedrafttitle sofa", description: "a draft that must never surface in public search results", city: "toronto", category: "furniture-home" },
    });
    const { rows, total } = await searchListings(parseSearchParams({ q: "zzduniquedrafttitle" }));
    expect(total).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it("discardDraft removes it", async () => {
    await discardDraft(userId);
    expect(await getDraft(userId)).toBeNull();
  });

  it("stale drafts are swept on access", async () => {
    const d = await getOrCreateDraft(userId);
    await db.listing.update({ where: { id: d.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } });
    expect(await getDraft(userId)).toBeNull();
  });
});
```

Run: `npx vitest run lib/draft.integration.test.ts` → PASS (4 tests). The search-invisibility test is the load-bearing one (spec §2, §11).

- [ ] **Step 6: Commit**

```powershell
git add lib/draft.ts lib/draft.test.ts lib/draft.integration.test.ts
git commit -m "Add draft lifecycle with step gates and public invisibility test"
```

---

### Task 9: Wizard steps 1–3 (category, details, location)

**Files:**
- Create: `app/post-ad/actions.ts`
- Create: `app/post-ad/layout.tsx` (step progress bar)
- Create: `app/post-ad/page.tsx` (step 1: category)
- Create: `app/post-ad/details/page.tsx`
- Create: `app/post-ad/location/page.tsx`
- Create: `components/wizard/StepShell.tsx`
- Create: `components/wizard/DetailsFields.tsx`
- Create: `components/wizard/LocationFields.tsx`

**Interfaces:**
- Consumes: `requireUserId`, `getOrCreateDraft`, `getDraft`, `firstIncompleteStep`, `stepPath`, `CategoryStepSchema`, `DetailsStepSchema`, `LocationStepSchema`, `CATEGORIES`, `CITIES`.
- Produces: server actions `saveCategory`, `saveDetails`, `saveLocation`, `discardAndRestart`; shared field components `DetailsFields({ defaults, errors })`, `LocationFields({ defaults, errors })` reused verbatim by Task 12's edit page.

**Gate rule (every step page):** load the draft; if none exists and the route is not step 1, `redirect("/post-ad")`. Compute `firstIncompleteStep(draft)`; if the current step comes later in `STEP_ORDER` than that, `redirect(stepPath(firstIncomplete))`.

- [ ] **Step 1: Create `app/post-ad/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateDraft, getDraft, discardDraft } from "@/lib/draft";
import { CategoryStepSchema, DetailsStepSchema, LocationStepSchema } from "@/lib/validation";
import type { FormState } from "@/app/auth/actions";

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = CategoryStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const draft = await getOrCreateDraft(userId);
  await db.listing.update({
    where: { id: draft.id },
    data: { category: parsed.data.category, subcategory: parsed.data.subcategory || null },
  });
  redirect("/post-ad/details");
}

export async function saveDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");

  const parsed = DetailsStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, fieldErrors };
  }
  await db.listing.update({
    where: { id: draft.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      priceType: parsed.data.priceType,
      price: parsed.data.price,
    },
  });
  redirect("/post-ad/location");
}

export async function saveLocation(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");

  const parsed = LocationStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, fieldErrors };
  }
  await db.listing.update({
    where: { id: draft.id },
    data: {
      city: parsed.data.city,
      neighbourhood: parsed.data.neighbourhood || null,
      postalCode: parsed.data.postalCode || null,
    },
  });
  redirect("/post-ad/photos");
}

export async function discardAndRestart(): Promise<void> {
  const userId = await requireUserId();
  await discardDraft(userId);
  redirect("/post-ad");
}
```

- [ ] **Step 2: Create `components/wizard/StepShell.tsx`**

```tsx
import Link from "next/link";
import { STEP_ORDER, stepPath, type WizardStep } from "@/lib/draft";

const LABELS: Record<WizardStep, string> = {
  category: "Category", details: "Details", location: "Location",
  photos: "Photos", boost: "Boost", review: "Review",
};

/** Wraps every wizard step: numbered progress indicator + card. Steps up to
 *  maxReached are links (backward navigation); later ones are inert. */
export function StepShell({
  current, maxReached, children,
}: { current: WizardStep; maxReached: WizardStep; children: React.ReactNode }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  const maxIdx = STEP_ORDER.indexOf(maxReached);
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ol className="flex items-center gap-1 text-xs">
        {STEP_ORDER.map((s, i) => {
          const active = i === currentIdx;
          const reachable = i <= maxIdx && !active;
          const cls = `flex-1 rounded-btn px-1 py-1.5 text-center font-medium ${
            active ? "bg-brand text-white" : reachable ? "bg-brand-50 text-brand" : "bg-surface-alt text-ink-faint"}`;
          return (
            <li key={s} className={cls} aria-current={active ? "step" : undefined}>
              {reachable ? <Link href={stepPath(s)}>{i + 1}. {LABELS[s]}</Link> : <>{i + 1}. {LABELS[s]}</>}
            </li>
          );
        })}
      </ol>
      <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create step 1 — `app/post-ad/page.tsx`**

```tsx
import type { Metadata } from "next";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep } from "@/lib/draft";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { StepShell } from "@/components/wizard/StepShell";
import { CategoryForm } from "./CategoryForm";
import { discardAndRestart } from "./actions";
import { getCategoryLabel } from "@/lib/categories";

export const metadata: Metadata = { title: "Post an ad", robots: { index: false } };

export default async function CategoryStepPage() {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  const resume = draft ? firstIncompleteStep(draft) : null;

  return (
    <StepShell current="category" maxReached={resume ?? "category"}>
      <h1 className="text-lg font-bold text-ink">What are you posting?</h1>

      {draft && draft.title && (
        <div className="mt-3 flex items-center justify-between rounded-card bg-brand-50 px-4 py-3 text-sm">
          <p className="text-ink">
            You have a draft: <strong>{draft.title}</strong>
            {draft.category ? ` (${getCategoryLabel(draft.category)})` : ""}
          </p>
          <form action={discardAndRestart}>
            <button type="submit" className="font-medium text-red-600 hover:underline">Discard</button>
          </form>
        </div>
      )}

      <CategoryForm
        categories={CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, icon: c.icon, subcategories: c.subcategories }))}
        defaultCategory={draft?.category ?? ""}
        defaultSubcategory={draft?.subcategory ?? ""}
      />
    </StepShell>
  );
}
```

`app/post-ad/CategoryForm.tsx` (client): radio-style grid of category cards (icon + label, `input type="radio" name="category"` visually hidden with the card as its label, ring on `:checked`), a subcategory `<select name="subcategory">` populated from the chosen category, and a Continue button submitting `saveCategory` via `useFormState`. Show `state.error` in red. (Uses `CategoryIcon` exactly as the homepage grid does.)

- [ ] **Step 4: Create `components/wizard/DetailsFields.tsx`** (server-renderable, reused by edit)

```tsx
// Shared by /post-ad/details and /listing/[id]/edit — one source of truth for
// the details form fields (spec §6).
export function DetailsFields({
  defaults, fieldErrors = {},
}: {
  defaults: { title: string; description: string; priceType: string; price: string };
  fieldErrors?: Record<string, string>;
}) {
  const input = "mt-1 h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
  const err = (k: string) => fieldErrors[k]
    ? <p role="alert" className="mt-1 text-sm text-red-600">{fieldErrors[k]}</p> : null;

  return (
    <>
      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="title">Title</label>
      <input id="title" name="title" required maxLength={80} defaultValue={defaults.title} className={input} />
      {err("title")}

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="description">Description</label>
      <textarea id="description" name="description" required minLength={20} maxLength={2000} rows={6}
        defaultValue={defaults.description} className="mt-1 w-full rounded-btn border border-line p-3 text-sm focus:border-brand" />
      {err("description")}

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-ink">Price</legend>
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          {(["fixed", "free", "contact", "trade"] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5">
              <input type="radio" name="priceType" value={t} defaultChecked={defaults.priceType === t} className="h-4 w-4 text-brand" />
              {{ fixed: "Amount (CAD)", free: "Free", contact: "Please contact", trade: "Trade" }[t]}
            </label>
          ))}
        </div>
        <input name="price" type="number" inputMode="decimal" min="0" max="9999999" step="0.01"
          placeholder="$ amount" defaultValue={defaults.price} className={`${input} max-w-48`} />
        {err("price")}
      </fieldset>
    </>
  );
}
```

- [ ] **Step 5: Create `components/wizard/LocationFields.tsx`**

```tsx
import { CITIES } from "@/lib/cities";

export function LocationFields({
  defaults, fieldErrors = {},
}: {
  defaults: { city: string; neighbourhood: string; postalCode: string };
  fieldErrors?: Record<string, string>;
}) {
  const input = "mt-1 h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
  const err = (k: string) => fieldErrors[k]
    ? <p role="alert" className="mt-1 text-sm text-red-600">{fieldErrors[k]}</p> : null;
  const neighbourhoods = CITIES.flatMap((c) => c.neighbourhoods);

  return (
    <>
      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="city">City</label>
      <select id="city" name="city" required defaultValue={defaults.city} className={`${input} bg-surface`}>
        <option value="" disabled>Choose a city…</option>
        {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      {err("city")}

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="neighbourhood">Neighbourhood (optional)</label>
      <input id="neighbourhood" name="neighbourhood" list="hoods" maxLength={80}
        defaultValue={defaults.neighbourhood} className={input} />
      <datalist id="hoods">
        {neighbourhoods.map((n) => <option key={n} value={n} />)}
      </datalist>

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="postalCode">Postal code (optional)</label>
      <input id="postalCode" name="postalCode" maxLength={7} placeholder="M5V 2T6"
        defaultValue={defaults.postalCode} className={`${input} max-w-40`} />
      <p className="mt-1 text-xs text-ink-faint">Used for distance sorting later. Never shown publicly.</p>
      {err("postalCode")}
    </>
  );
}
```

- [ ] **Step 6: Create the details and location step pages**

`app/post-ad/details/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep, STEP_ORDER, stepPath } from "@/lib/draft";
import { StepShell } from "@/components/wizard/StepShell";
import { DetailsStepForm } from "./DetailsStepForm";

export default async function DetailsStepPage() {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");
  const gate = firstIncompleteStep(draft);
  if (STEP_ORDER.indexOf("details") > STEP_ORDER.indexOf(gate)) redirect(stepPath(gate));

  return (
    <StepShell current="details" maxReached={gate}>
      <h1 className="text-lg font-bold text-ink">Describe your item</h1>
      <DetailsStepForm defaults={{
        title: draft.title,
        description: draft.description,
        priceType: draft.priceType,
        price: draft.price?.toString() ?? "",
      }} />
    </StepShell>
  );
}
```

`app/post-ad/details/DetailsStepForm.tsx` (client): `useFormState(saveDetails, { ok: false })`, renders `<DetailsFields defaults={defaults} fieldErrors={state.fieldErrors} />` inside a `<form action={formAction}>` with a Continue submit button and a "Back" link to `/post-ad`.

`app/post-ad/location/page.tsx` + `LocationStepForm.tsx`: identical pattern with `current="location"`, `LocationFields`, action `saveLocation`, back link to `/post-ad/details`.

- [ ] **Step 7: Create `app/post-ad/layout.tsx`**

```tsx
export default function PostAdLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface-alt min-h-[70vh] pb-10">{children}</div>;
}
```

- [ ] **Step 8: Browser-verify steps 1–3** — sign in, walk category → details → location; verify: validation errors render (submit a 5-char description); refresh mid-way and values persist; direct-jump to `/post-ad/review` bounces back to `/post-ad/photos`... (photos not built yet — expect 404 after location; that is this task's boundary, note it and move on); sign out, hit `/post-ad`, get bounced to signin.

- [ ] **Step 9: Full suite + commit**

```powershell
npx vitest run
git add app/post-ad components/wizard
git commit -m "Add wizard steps 1-3 with draft persistence and server-side gates"
```

---

### Task 10: Wizard steps 4–6 (photos, boost, review) and publish

**Files:**
- Create: `components/wizard/PhotoUploader.tsx`
- Create: `app/post-ad/photos/page.tsx`
- Create: `app/post-ad/boost/page.tsx`
- Create: `app/post-ad/review/page.tsx`
- Create: `lib/manage.ts` (publish + later dashboard mutations)
- Create: `lib/manage.integration.test.ts`
- Modify: `app/post-ad/actions.ts` (add `savePhotos`, `publishAction`)

**Interfaces:**
- Consumes: `cloudinaryConfig`, `PhotosStepSchema`, `violatesModeration`, `rateLimit`, draft helpers.
- Produces: `publishDraft(userId): Promise<{ ok: true; listingId: string } | { ok: false; error: string }>` in `lib/manage.ts`; server actions `savePhotos`, `publishAction`.

- [ ] **Step 1: Write failing integration test for publish**

`lib/manage.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateDraft } from "@/lib/draft";
import { publishDraft } from "@/lib/manage";
import { getPublicListing } from "@/lib/listing";

let userId: string;
const EMAIL = `vitest-publish-${Date.now()}@example.com`;

beforeAll(async () => {
  const u = await db.user.create({ data: { email: EMAIL, name: "Publish Test" } });
  userId = u.id;
});
afterAll(async () => {
  await db.listing.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

describe("publishDraft", () => {
  it("refuses an incomplete draft", async () => {
    await getOrCreateDraft(userId);
    const r = await publishDraft(userId);
    expect(r.ok).toBe(false);
  });

  it("refuses a draft that violates moderation", async () => {
    await db.listing.updateMany({ where: { userId, status: "draft" }, data: {
      title: "cheap cocaine here", description: "definitely long enough description text for the gate", category: "electronics", city: "toronto",
    }});
    const r = await publishDraft(userId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toMatch(/cocaine/i); // generic — never echo the word
  });

  it("publishes a clean complete draft: active, 30-day expiry, publicly visible", async () => {
    await db.listing.updateMany({ where: { userId, status: "draft" }, data: {
      title: "Vitest test lamp", description: "A perfectly ordinary lamp used to test the publish pipeline.", category: "furniture-home", city: "toronto",
    }});
    const r = await publishDraft(userId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pub = await getPublicListing(r.listingId);
    expect(pub).not.toBeNull();
    expect(pub!.title).toBe("Vitest test lamp");
    const row = await db.listing.findUnique({ where: { id: r.listingId } });
    expect(row!.status).toBe("active");
    const days = (row!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/manage.integration.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/manage.ts` (publish half)**

```ts
import { db } from "@/lib/db";
import { getDraft } from "@/lib/draft";
import { firstIncompleteStep } from "@/lib/draft";
import { violatesModeration } from "@/lib/moderation";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function publishDraft(
  userId: string,
): Promise<{ ok: true; listingId: string } | { ok: false; error: string }> {
  const draft = await getDraft(userId);
  if (!draft) return { ok: false, error: "No draft to publish." };

  if (firstIncompleteStep(draft) !== "review") {
    return { ok: false, error: "Your ad is missing required information." };
  }

  // Generic rejection — never reveal which word tripped (spec §4).
  if (violatesModeration(`${draft.title}\n${draft.description}`)) {
    return { ok: false, error: "This listing can't be published as written. Please revise the title or description." };
  }

  const updated = await db.listing.update({
    where: { id: draft.id },
    data: { status: "active", expiresAt: new Date(Date.now() + THIRTY_DAYS) },
  });
  return { ok: true, listingId: updated.id };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/manage.integration.test.ts` → PASS (3 tests).

- [ ] **Step 5: Add `savePhotos` and `publishAction` to `app/post-ad/actions.ts`**

```ts
import { PhotosStepSchema } from "@/lib/validation";
import { cloudinaryConfig } from "@/lib/env";
import { publishDraft } from "@/lib/manage";
import { rateLimit } from "@/lib/rate-limit";

export async function savePhotos(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");

  const cfg = cloudinaryConfig();
  const images = formData.getAll("images").map(String).filter(Boolean);
  if (images.length > 0) {
    if (!cfg) return { ok: false, error: "Photo uploads aren't configured yet." };
    const parsed = PhotosStepSchema(cfg.cloudName).safeParse({ images });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  }
  await db.listing.update({ where: { id: draft.id }, data: { images } });
  redirect("/post-ad/boost");
}

export async function publishAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  if (!rateLimit(`publish:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "You've reached the daily posting limit." };
  }
  const r = await publishDraft(userId);
  if (!r.ok) return { ok: false, error: r.error };
  redirect(`/listing/${r.listingId}`);
}
```

- [ ] **Step 6: Create `components/wizard/PhotoUploader.tsx`** (client)

```tsx
"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { savePhotos } from "@/app/post-ad/actions";
import type { FormState } from "@/app/auth/actions";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUploader({
  cloudName, uploadPreset, initial,
}: { cloudName: string; uploadPreset: string; initial: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useFormState<FormState, FormData>(savePhotos, { ok: false });

  async function onFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const files = Array.from(list).slice(0, 10 - urls.length);
    for (const f of files) {
      if (!TYPES.includes(f.type)) { setError("Only JPEG, PNG or WEBP images."); continue; }
      if (f.size > MAX_BYTES) { setError("Each photo must be under 5 MB."); continue; }
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", f);
        body.append("upload_preset", uploadPreset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { secure_url: string };
        setUrls((u) => [...u, json.secure_url]);
      } catch {
        setError("Upload failed — please try that photo again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const move = (i: number, dir: -1 | 1) => setUrls((u) => {
    const j = i + dir;
    if (j < 0 || j >= u.length) return u;
    const copy = [...u]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });

  return (
    <form action={formAction}>
      {urls.map((u) => <input key={u} type="hidden" name="images" value={u} />)}

      <label className="mt-4 flex cursor-pointer flex-col items-center rounded-card border-2 border-dashed border-line p-8 text-center hover:border-brand">
        <span className="text-sm font-medium text-ink">Click to add photos</span>
        <span className="mt-1 text-xs text-ink-faint">Up to 10 · JPEG, PNG or WEBP · 5 MB each</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
          onChange={(e) => onFiles(e.target.files)} disabled={urls.length >= 10} />
      </label>

      {uploading > 0 && <p className="mt-2 text-sm text-ink-muted">Uploading {uploading}…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {state.error && <p role="alert" className="mt-2 text-sm text-red-600">{state.error}</p>}

      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {urls.map((u, i) => (
          <li key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary preview thumbnails; next/image not worth remotePatterns churn here */}
            <img src={u} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-btn object-cover ring-1 ring-line" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-brand px-1 text-[10px] font-semibold text-white">Cover</span>}
            <div className="mt-1 flex justify-center gap-1 text-xs">
              <button type="button" onClick={() => move(i, -1)} aria-label="Move earlier" className="rounded border border-line px-1.5 hover:border-brand">←</button>
              <button type="button" onClick={() => setUrls((x) => x.filter((_, j) => j !== i))} aria-label="Remove" className="rounded border border-line px-1.5 text-red-600 hover:border-red-600">✕</button>
              <button type="button" onClick={() => move(i, 1)} aria-label="Move later" className="rounded border border-line px-1.5 hover:border-brand">→</button>
            </div>
          </li>
        ))}
      </ul>

      <button type="submit" disabled={uploading > 0}
        className="mt-6 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        Continue
      </button>
    </form>
  );
}
```

- [ ] **Step 7: Create `app/post-ad/photos/page.tsx`** — standard gate preamble (as in Task 9 Step 6), then:

```tsx
const cfg = cloudinaryConfig();
return (
  <StepShell current="photos" maxReached={gate}>
    <h1 className="text-lg font-bold text-ink">Add photos</h1>
    {cfg ? (
      <PhotoUploader cloudName={cfg.cloudName} uploadPreset={cfg.uploadPreset} initial={draft.images} />
    ) : (
      <div className="mt-4">
        <p className="rounded-card bg-surface-alt px-4 py-3 text-sm text-ink-muted">
          Photo uploads aren't configured yet. You can publish without photos and add them later.
        </p>
        <SkipPhotosForm />
      </div>
    )}
  </StepShell>
);
```

`SkipPhotosForm` is a tiny client form submitting `savePhotos` with no images (Continue button only). This is the spec §8 Cloudinary degraded mode.

- [ ] **Step 8: Create `app/post-ad/boost/page.tsx`** — gate preamble, then a static card list: Free (radio, checked, enabled) plus Top $4.99/7d, Featured $9.99/14d, Super Boost $14.99/30d rendered as `opacity-60` cards each with a "Available soon" chip — the Phase 1 honest-disabled pattern; no Stripe code. Continue is a plain `<Link href="/post-ad/review">` styled as the primary button (nothing to save).

- [ ] **Step 9: Create `app/post-ad/review/page.tsx`** — gate preamble (`gate !== "review"` redirects to `stepPath(gate)`), then a summary card per section (Category, Details, Location, Photos count, Boost: Free) each with an "Edit" link to its step; postal code shown here is fine (owner-only page). Publish form (client, `useFormState(publishAction)`) with `state.error` in red and a full-width Publish button.

- [ ] **Step 10: Browser-verify the full wizard** — walk all six steps signed in (degraded photo mode expected — no Cloudinary keys): publish, land on the live `/listing/[id]`, confirm it appears on the homepage "Recently posted" and in `/search`. Attempt `/post-ad/review` immediately after (draft gone) → back at `/post-ad` with a fresh empty wizard. Confirm the moderation path: put a banned word in a details title, publish → generic error on review page.

- [ ] **Step 11: Full suite + commit**

```powershell
npx vitest run
git add app/post-ad components/wizard lib/manage.ts lib/manage.integration.test.ts
git commit -m "Add photos, boost teaser, review and publish with moderation gate"
```

---

### Task 11: Dashboard — My Ads and account settings

**Files:**
- Modify: `lib/manage.ts` (add `markSold`, `softDeleteListing`, `relistListing`, `NotOwnerError`)
- Modify: `lib/manage.integration.test.ts` (ownership + lifecycle tests)
- Create: `app/dashboard/page.tsx`
- Create: `app/dashboard/actions.ts`
- Create: `app/dashboard/MyAdRow.tsx`
- Create: `app/dashboard/SettingsForms.tsx`

**Interfaces:**
- Consumes: `requireUserId`, `db`, `ProfileSchema`, `ChangePasswordSchema`, `verifyPassword`, `hashPassword`, `invalidateResetTokens`, `formatPrice`, `formatRelativeTime`.
- Produces: `markSold(userId, listingId)`, `softDeleteListing(userId, listingId)`, `relistListing(userId, listingId)` — each throws `NotOwnerError` when `listing.userId !== userId`; server actions `markSoldAction`, `deleteAction`, `relistAction`, `updateProfileAction`, `changePasswordAction`.

- [ ] **Step 1: Write failing tests** — append to `lib/manage.integration.test.ts`:

```ts
import { markSold, softDeleteListing, relistListing, NotOwnerError } from "@/lib/manage";

describe("listing lifecycle mutations", () => {
  let otherUserId: string;
  let listingId: string;
  const EMAIL2 = `vitest-other-${Date.now()}@example.com`;

  beforeAll(async () => {
    const other = await db.user.create({ data: { email: EMAIL2, name: "Other" } });
    otherUserId = other.id;
    const l = await db.listing.create({ data: {
      title: "Lifecycle lamp", description: "A lamp for testing ownership and lifecycle transitions.",
      category: "furniture-home", city: "toronto", images: [], status: "active",
      expiresAt: new Date(Date.now() + 30 * 86_400_000), userId,
    }});
    listingId = l.id;
  });
  afterAll(async () => { await db.user.deleteMany({ where: { email: EMAIL2 } }); });

  it("a non-owner cannot mutate (IDOR guard)", async () => {
    await expect(markSold(otherUserId, listingId)).rejects.toThrow(NotOwnerError);
    await expect(softDeleteListing(otherUserId, listingId)).rejects.toThrow(NotOwnerError);
    await expect(relistListing(otherUserId, listingId)).rejects.toThrow(NotOwnerError);
  });

  it("mark sold → relist resets a 30-day expiry and reactivates", async () => {
    await markSold(userId, listingId);
    expect((await db.listing.findUnique({ where: { id: listingId } }))!.status).toBe("sold");
    await relistListing(userId, listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.status).toBe("active");
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it("delete is soft — row remains, status deleted, invisible publicly", async () => {
    await softDeleteListing(userId, listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.status).toBe("deleted");
    const { getPublicListing } = await import("@/lib/listing");
    expect(await getPublicListing(listingId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/manage.integration.test.ts` → FAIL (missing exports).

- [ ] **Step 3: Implement the mutations in `lib/manage.ts`**

```ts
export class NotOwnerError extends Error {
  constructor() { super("Not the owner of this listing"); }
}

/** Loads the listing and enforces ownership — the IDOR guard every dashboard
 *  mutation goes through. Client-supplied IDs are never trusted alone. */
async function ownedListing(userId: string, listingId: string) {
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status === "deleted") throw new NotOwnerError();
  if (listing.userId !== userId) throw new NotOwnerError();
  return listing;
}

export async function markSold(userId: string, listingId: string): Promise<void> {
  await ownedListing(userId, listingId);
  await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
}

export async function softDeleteListing(userId: string, listingId: string): Promise<void> {
  await ownedListing(userId, listingId);
  await db.listing.update({ where: { id: listingId }, data: { status: "deleted" } });
}

export async function relistListing(userId: string, listingId: string): Promise<void> {
  await ownedListing(userId, listingId);
  // createdAt untouched: relisting is not a free bump to the top (spec §5).
  await db.listing.update({
    where: { id: listingId },
    data: { status: "active", expiresAt: new Date(Date.now() + THIRTY_DAYS) },
  });
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/manage.integration.test.ts` → PASS (6 tests).

- [ ] **Step 5: Create `app/dashboard/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { markSold, softDeleteListing, relistListing, NotOwnerError } from "@/lib/manage";
import { ProfileSchema, ChangePasswordSchema } from "@/lib/validation";
import { verifyPassword, hashPassword } from "@/lib/users";
import { invalidateResetTokens } from "@/lib/tokens";
import type { FormState } from "@/app/auth/actions";

async function lifecycle(fn: (u: string, l: string) => Promise<void>, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  try {
    await fn(userId, listingId);
  } catch (e) {
    if (!(e instanceof NotOwnerError)) throw e;
    // Silently no-op for non-owners: nothing to reveal.
  }
  revalidatePath("/dashboard");
}

export async function markSoldAction(formData: FormData) { await lifecycle(markSold, formData); }
export async function deleteAction(formData: FormData) { await lifecycle(softDeleteListing, formData); }
export async function relistAction(formData: FormData) { await lifecycle(relistListing, formData); }

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db.user.update({ where: { id: userId }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = ChangePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await invalidateResetTokens(userId);
  return { ok: true };
}
```

- [ ] **Step 6: Create `app/dashboard/page.tsx`**

Server component: `requireUserId()`, then fetch the user and their listings:

```tsx
const listings = await db.listing.findMany({
  where: { userId, status: { not: "deleted" } },
  select: { id: true, title: true, price: true, priceType: true, status: true, images: true, views: true, createdAt: true, expiresAt: true },
  orderBy: { createdAt: "desc" },
});
```

Derive display status: `status === "active" && expiresAt < now` renders as **Expired**. Layout: page heading "Dashboard"; tab strip — **My Ads** (active), plus `Saved` and `Messages` rendered as disabled chips with `title="Coming soon"` (Phase 1 pattern); the ads list (`MyAdRow` per listing, empty state with a "Post your first ad" link to `/post-ad`); then an "Account settings" section rendering `SettingsForms` with the user's current name/phone.

- [ ] **Step 7: Create `app/dashboard/MyAdRow.tsx`**

Server component per row: 64px thumbnail (`next/image`, first image or "No photo" block), title linking to `/listing/[id]` (or `/post-ad` for drafts — "Continue draft"), price via `formatPrice`, status chip (`Active` green `bg-brand-50 text-brand`, `Sold` grey, `Expired` amber `bg-amber-50 text-amber-700`, `Draft` outline), views count, posted `formatRelativeTime`. Actions as inline `<form>` buttons: Edit (link to `/listing/[id]/edit`), Mark sold (`markSoldAction`) when active; Relist (`relistAction`) when sold/expired; Delete via `DeleteButton` — a small client component that renders the form button and intercepts submit with `if (!confirm("Delete this ad permanently? It will disappear from the site.")) e.preventDefault()`.

- [ ] **Step 8: Create `app/dashboard/SettingsForms.tsx`** (client) — two `useFormState` forms side by side (stack on mobile): profile (name, phone → `updateProfileAction`) and change password (current, new, confirm → `changePasswordAction`); success renders a green "Saved." / "Password changed." line, errors in red.

- [ ] **Step 9: Browser-verify** — dashboard lists the ad published in Task 10; mark sold → chip flips; relist → active again; delete → row gone and the public listing 404s; profile save + password change round-trip (change it, sign out, sign back in with the new password); Saved/Messages tabs visibly disabled.

- [ ] **Step 10: Full suite + commit**

```powershell
npx vitest run
git add lib/manage.ts lib/manage.integration.test.ts app/dashboard
git commit -m "Add dashboard My Ads with lifecycle actions and account settings"
```

---

### Task 12: Edit ad page

**Files:**
- Create: `app/listing/[id]/edit/page.tsx`
- Create: `app/listing/[id]/edit/actions.ts`
- Create: `app/listing/[id]/edit/EditForms.tsx`

**Interfaces:**
- Consumes: `requireUserId`, `db`, `DetailsStepSchema`, `LocationStepSchema`, `PhotosStepSchema`, `violatesModeration`, `DetailsFields`, `LocationFields`, `PhotoUploader` pattern, `NotOwnerError` guard (reuse `ownedListing` by exporting it from `lib/manage.ts`).
- Produces: server actions `updateDetails`, `updateLocation`, `updatePhotos` — each takes `listingId` from a hidden field, enforces ownership, validates with the same schemas as the wizard, moderation-checks on `updateDetails`.

- [ ] **Step 1: Export `ownedListing` from `lib/manage.ts`** (change `async function` to `export async function`).

- [ ] **Step 2: Create `app/listing/[id]/edit/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownedListing, NotOwnerError } from "@/lib/manage";
import { DetailsStepSchema, LocationStepSchema, PhotosStepSchema } from "@/lib/validation";
import { violatesModeration } from "@/lib/moderation";
import { cloudinaryConfig } from "@/lib/env";
import type { FormState } from "@/app/auth/actions";

async function guard(formData: FormData): Promise<{ userId: string; listingId: string } | null> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  try {
    await ownedListing(userId, listingId);
    return { userId, listingId };
  } catch (e) {
    if (e instanceof NotOwnerError) return null;
    throw e;
  }
}

export async function updateDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await guard(formData);
  if (!ctx) return { ok: false, error: "You can't edit this listing." };

  const parsed = DetailsStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, fieldErrors };
  }
  if (violatesModeration(`${parsed.data.title}\n${parsed.data.description}`)) {
    return { ok: false, error: "These changes can't be published as written." };
  }
  await db.listing.update({ where: { id: ctx.listingId }, data: {
    title: parsed.data.title, description: parsed.data.description,
    priceType: parsed.data.priceType, price: parsed.data.price,
  }});
  revalidatePath(`/listing/${ctx.listingId}`);
  return { ok: true };
}

export async function updateLocation(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await guard(formData);
  if (!ctx) return { ok: false, error: "You can't edit this listing." };
  const parsed = LocationStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db.listing.update({ where: { id: ctx.listingId }, data: {
    city: parsed.data.city, neighbourhood: parsed.data.neighbourhood || null, postalCode: parsed.data.postalCode || null,
  }});
  revalidatePath(`/listing/${ctx.listingId}`);
  return { ok: true };
}

export async function updatePhotos(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await guard(formData);
  if (!ctx) return { ok: false, error: "You can't edit this listing." };
  const images = formData.getAll("images").map(String).filter(Boolean);
  const cfg = cloudinaryConfig();
  if (images.length > 0) {
    if (!cfg) return { ok: false, error: "Photo uploads aren't configured yet." };
    const parsed = PhotosStepSchema(cfg.cloudName).safeParse({ images });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  }
  await db.listing.update({ where: { id: ctx.listingId }, data: { images } });
  revalidatePath(`/listing/${ctx.listingId}`);
  return { ok: true };
}
```

- [ ] **Step 3: Create the page** — `app/listing/[id]/edit/page.tsx`: `requireUserId()`; load the listing with an explicit select INCLUDING `postalCode` (owner-only page — the one legitimate read); `notFound()` if missing/deleted or not owned. Render heading "Edit ad", the status chip, then `EditForms` (client) which stacks three cards — Details (`DetailsFields` + hidden `listingId`, submit `updateDetails`, "Saved." on success), Location (`LocationFields`, `updateLocation`), Photos (reuse the `PhotoUploader` UI pattern but submitting `updatePhotos`; in degraded mode show existing photos with remove/reorder only, no upload box) — plus a footer row with Mark as Sold / Relist / Delete (same actions as the dashboard, redirecting back to `/dashboard` after delete).

- [ ] **Step 4: Browser-verify** — edit own listing: change title, save, see it live on `/listing/[id]`; visit another user's listing `/listing/<seed-id>/edit` while signed in → 404, and confirm a direct `updateDetails` cannot be forged (covered by the `ownedListing` test in Task 11). Verify `createdAt`/`expiresAt` unchanged by edits (check dashboard "posted" time did not reset).

- [ ] **Step 5: Full suite + commit**

```powershell
npx vitest run
git add app/listing lib/manage.ts
git commit -m "Add owner-only edit page reusing wizard forms and validation"
```

---

### Task 13: Final verification and docs

**Files:**
- Modify: `README.md` (Phase 2 section)
- Modify: `docs` — none (specs already committed)

- [ ] **Step 1: Full test suite** — `npx vitest run` → all green (expect ~75+ tests).

- [ ] **Step 2: Production build** — STOP the dev server first (shared `.next`), then:

```powershell
npm run build
```

Expected: compiles, types check, all routes listed. Restart dev server afterwards (delete `.next` first if it errors).

- [ ] **Step 3: Full browser journey at both widths** (mobile 375px and desktop 1280px): register fresh user → post ad through all six steps → live listing → visible on homepage + search → edit title → mark sold → relist → delete → 404. Screenshot the wizard steps, dashboard and final listing; share with the user.

- [ ] **Step 4: Degraded-modes sweep** — with no Google/Cloudinary/Resend keys: no Google button on signin; photos step shows the skip path; forgot-password says unconfigured. (These are the shipping defaults until keys arrive.)

- [ ] **Step 5: Postal-code leak check** — fetch a published listing page and `/search` HTML; assert no postal code appears (they only ever render on `/post-ad/review` and `/listing/[id]/edit`, both owner-gated).

- [ ] **Step 6: Update `README.md`** — under the phase status lines, change Phase 2 to current-done, note the new env vars (point at `.env.example`), and add one line: "Auth: NextAuth v4, JWT sessions; all mutation logic in `lib/manage.ts` / `lib/draft.ts` with ownership enforced server-side."

- [ ] **Step 7: Commit**

```powershell
git add README.md
git commit -m "Verify Phase 2 end to end and document setup"
```

---

## Self-review notes

- **Spec coverage:** §1 keys-later → Tasks 1, 6 (conditional provider), 10 (photo skip), 7 (forgot honest failure). §2 schema → Task 2. §3 auth → Tasks 6–7. §4 wizard → Tasks 8–10. §5 dashboard → Task 11. §6 edit → Task 12. §7 security → ownership tests (Task 11), rate limits (Tasks 3, 6, 7, 10), postal-code check (Task 13). §8 degraded modes → Task 13 sweep. §9 testing → per-task. §10 env → Task 1. §11 DoD → Task 13.
- **Deliberate scope cut:** account linking for Google-with-existing-credentials-email stays off (spec §3); no email verification gating (spec §12).
- **Type consistency check:** `FormState` defined once in `app/auth/actions.ts` and imported everywhere; `publishDraft` return shape matches its consumer in `publishAction`; `ownedListing` export added in Task 12 Step 1 before its consumer.
