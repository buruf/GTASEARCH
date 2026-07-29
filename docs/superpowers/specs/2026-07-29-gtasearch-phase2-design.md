# GTASearch — Phase 2: Accounts & Posting

**Date:** 2026-07-29
**Status:** Approved
**Scope:** Phase 2 of 3. Authentication, the post-ad wizard, image upload, and the
seller dashboard. Builds on the Phase 1 spec
(`2026-07-28-gtasearch-phase1-design.md`); Phase 1's schema, search layer and
public pages are unchanged except where stated.

---

## 1. Decisions made during design review

1. **Build everything now; external keys arrive later.** Email/password auth works
   immediately. The Google button, Cloudinary upload and Resend email are coded
   but degrade gracefully until their env vars exist: absent
   `GOOGLE_CLIENT_ID`, the Google button does not render; absent Cloudinary
   config, the photos step says uploads aren't configured and allows publishing
   without photos; absent `RESEND_API_KEY`, the forgot-password form states that
   email isn't configured yet rather than pretending to send.
2. **The wizard persists drafts in the database**, not browser state. Closing the
   tab mid-post loses nothing.
3. **Resend moves from Phase 3 into Phase 2**, because password reset requires
   email and shipping auth without a reset path locks users out.
4. **NextAuth v4 (stable)** with the Prisma adapter and JWT session strategy.
   v5 is beta; hand-rolled auth buys nothing here. Passwords hashed with
   bcryptjs at cost 12 (pure JS — no native build issues on Windows).

## 2. Schema additions

One migration. Nothing destructive; every Phase 1 row remains valid.

- `User.emailVerified DateTime?` — required by the NextAuth adapter contract.
  Phase 2 does not gate anything on it.
- `Account`, `Session`, `VerificationToken` — the standard NextAuth adapter
  tables. `Account` stores Google links. With JWT sessions `Session` stays
  empty, but the adapter requires it and it future-proofs a move to DB sessions.
- `PasswordResetToken`: `id`, `tokenHash` (SHA-256 of the emailed token — the
  raw token is never stored), `userId` (cascade delete), `expiresAt`
  (one hour), `usedAt DateTime?`. Single-use: consuming sets `usedAt`; a token
  with `usedAt` set or `expiresAt` past is rejected.
- `Listing.status` gains the value `"draft"`. Status remains a string column;
  no migration of existing values. Drafts are invisible to all public surfaces
  for free, because Phase 1's shared `VISIBLE` filter already requires
  `status = 'active'` — this must be verified by test, not assumed.
- Draft hygiene: drafts older than 7 days are deleted by an on-demand sweep
  when the owner opens `/post-ad` (scoped to that user). The Phase 3 nightly
  cron takes this job over globally.

## 3. Auth

### Pages

`/auth/signin` and `/auth/register` — one tabbed component, two routes, per the
original product spec. Both redirect to `callbackUrl` (or `/dashboard`) when
already signed in.

- **Register:** first name, last name, email, password (min 8 chars), confirm
  password. Client-side HTML validation plus Zod on the server action.
- **Sign in:** email + password via the NextAuth credentials provider, plus a
  "Forgot password?" link. Google OAuth button renders only when configured.
- **Anti-enumeration:** registration and forgot-password return the identical
  success response whether or not the email is already registered / exists.
  Real state arrives by email. Sign-in failures are a single generic message.
  (Same class of fix as the eduyro login-enumeration audit item.)

### Forgot / reset password

`/auth/forgot` (email form) → Resend sends a link containing a 32-byte random
token → `/auth/reset/[token]` (new password form). Token is hashed at rest,
expires in one hour, is single-use, and all outstanding tokens for a user are
invalidated on successful reset and on password change.

### Session & protection

- JWT strategy. `session.user.id` is injected via the `jwt`/`session` callbacks.
- `middleware.ts` protects `/post-ad`, `/dashboard`, and `/listing/*/edit`,
  bouncing to `/auth/signin?callbackUrl=<original>`.
- Header: signed-out shows Sign In / Register (Phase 1 behaviour, links rewired
  from `/coming-soon` to the real pages); signed-in shows the user's first name
  with a menu (Dashboard, Sign out). Post Ad goes to the real wizard.

### Google OAuth

Standard NextAuth Google provider. Account linking rule: if a Google sign-in
arrives with an email that already has a credentials account,
`allowDangerousEmailAccountLinking` stays **off**; the user is told to sign in
with their password instead. (Revisit only if it becomes a real support burden.)

## 4. Post-ad wizard

Route per step under `/post-ad`:

| Step | Route | Fields |
|---|---|---|
| 1 Category | `/post-ad` | category picker (Phase 1 icon grid), then subcategory |
| 2 Details | `/post-ad/details` | title ≤80, description 20–2000, priceType (fixed/free/contact/trade), price if fixed |
| 3 Location | `/post-ad/location` | city (known slugs only), neighbourhood (datalist autocomplete from `lib/cities`), postal code (optional, never public) |
| 4 Photos | `/post-ad/photos` | up to 10 images via Cloudinary |
| 5 Boost | `/post-ad/boost` | free preselected; Top/Featured/Super render as disabled cards with real prices and "Available soon" |
| 6 Review | `/post-ad/review` | summary with per-section edit links, Publish button |

Mechanics:

- Step 1 creates (or reuses) the user's draft listing row; every subsequent step
  is a server-rendered form whose server action validates with Zod, writes to
  the draft, and redirects onward. Back navigation re-populates from the draft.
- **One draft per user**, enforced by a partial unique index added by hand to
  the migration (`CREATE UNIQUE INDEX ... ON "Listing"("userId") WHERE status =
  'draft'`) — Prisma cannot declare partial indexes, and we already hand-edit
  migrations for search. A database guarantee beats an application check here
  because the wizard has several entry points. Opening `/post-ad` with an existing draft offers: continue draft
  (jump to first incomplete step) or discard and start over.
- **Step gates:** every step's page and action recompute "first incomplete
  step" server-side; jumping ahead by URL redirects back to it. The gate
  function is pure and unit-tested.
- **Photos:** client component uploads directly to Cloudinary with the unsigned
  preset (5 MB max, JPEG/PNG/WEBP, per-image spinner), then saves secure URLs
  to the draft via server action. Reorder (move up/down) and delete before
  publish. The URL list is validated server-side: max 10, each must match
  `https://res.cloudinary.com/<cloud>/...`.
- **Moderation:** at publish, title + description are checked against a
  banned-words list (`lib/moderation.ts`, word-boundary matching, obvious
  leet-speak variants). Rejection is generic — the tripped word is not echoed.
- **Publish:** validates the entire draft once more, sets `status = 'active'`,
  `expiresAt = now + 30 days`, redirects to `/listing/[id]`.

## 5. Dashboard

`/dashboard`, My Ads tab live; Saved and Messages tabs render disabled
("coming soon" pattern from Phase 1).

My Ads table: thumbnail, title, price, status chip (Active / Sold / Expired /
Draft), views, posted date, actions:

- **Edit** → `/listing/[id]/edit`
- **Mark sold** → status `sold` (confirmation; reversible via Relist)
- **Delete** → status `deleted` after a confirmation dialog. Soft delete only.
- **Relist** (expired or sold) → status `active`, `expiresAt = now + 30 days`,
  `createdAt` untouched (no free bump-to-top; revisit in Phase 3 with boosts).
- **Continue draft** → jumps into the wizard at the first incomplete step.

Account settings on the same page: change name/phone; change password (requires
current password; invalidates outstanding reset tokens). Email change and
account deletion are Phase 3.

## 6. Edit ad

`/listing/[id]/edit` reuses the wizard's step forms and validation against the
live listing instead of a draft — one shared form module, two data sources. No
separate edit implementation. "Mark as Sold" and "Delete" appear here too.
Editing an active listing does not change `createdAt` or `expiresAt`.

## 7. Security invariants

- **Ownership:** every mutating server action loads the row and checks
  `session.user.id === listing.userId` before acting. No mutation trusts a
  client-supplied ID alone. (The IDOR class from the eduyro audit.)
- **Validation:** Zod on every server action. Price 0–9,999,999 with two
  decimals; title/description length bounds; city/category/subcategory must be
  known slugs; image URLs must be Cloudinary URLs on our cloud.
- `postalCode` stays server-only (Phase 1 invariant, now with a write path —
  the review step shows it to its owner only).
- **Rate limits** (in-memory per-instance with TTL eviction — same stopgap as
  eduyro; Redis is an acknowledged H2 there and here): register 5/hr/IP,
  forgot-password 3/hr/email, publish 10/day/user.
- Secrets: `NEXTAUTH_SECRET` required at boot in production. `.env.example`
  updated with the full Phase 2 set, keys-later ones marked optional.

## 8. Degraded modes (keys-later)

| Missing config | Behaviour |
|---|---|
| `GOOGLE_CLIENT_ID/SECRET` | Google button absent; credentials auth unaffected |
| `CLOUDINARY_CLOUD_NAME/UPLOAD_PRESET` | Photos step explains uploads aren't configured; publishing without photos allowed |
| `RESEND_API_KEY` | Forgot-password form states email isn't configured; no fake success |

Each degraded mode is exercised in the browser before the keys arrive, because
that is how the app will actually run at first.

## 9. Testing

- **Vitest:** Zod schemas against hostile input; banned-words matcher (including
  word-boundary false-positive cases — "class" must not trip "ass");
  first-incomplete-step gate; reset-token expiry and single-use; rate-limiter
  eviction.
- **Integration (seeded DB):** register → create draft → walk every step →
  publish → listing appears in search; draft invisible in search and sitemap;
  editing a listing you don't own is rejected; relist resets expiry.
- **Browser:** full journey — register, post an ad with photos (or degraded
  photo mode), see it live, edit it, mark sold, relist — at mobile and desktop
  widths, screenshots supplied.

## 10. Environment variables

```
# Required in Phase 2
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3020   # prod: https://gtasearch.com

# Optional until keys arrive (degraded modes above)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_UPLOAD_PRESET=
RESEND_API_KEY=
EMAIL_FROM=GTASearch <noreply@gtasearch.com>
```

## 11. Definition of done

- Register, sign in, sign out, change password, forgot/reset password (with
  Resend key) all work.
- Full wizard walk produces a live listing visible on the homepage, in search
  and in the sitemap; abandoning mid-wizard and returning resumes the draft.
- Drafts never appear on any public surface (verified by test).
- Dashboard lists the user's ads with working edit / mark sold / delete /
  relist.
- Non-owners cannot mutate a listing by any route (verified by test).
- All degraded modes behave as specified with the env vars absent.
- Vitest suite passes; browser journey verified at both widths.

## 12. Explicitly out of scope

Stripe/boost payments, messaging, favourites, report-ad flow, expiry-reminder
emails, email verification gating, account deletion, admin tooling — Phase 3.
