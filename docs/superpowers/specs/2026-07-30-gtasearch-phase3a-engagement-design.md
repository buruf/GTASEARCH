# GTASearch — Phase 3A: Engagement (Messaging, Favourites, Reporting)

**Date:** 2026-07-30
**Status:** Approved
**Scope:** First half of Phase 3. Buyer–seller messaging with an inbox, saved
listings, phone-number reveal, and the report-ad flow. Builds on the Phase 1
and Phase 2 specs; their invariants remain binding.

Phase 3B (Stripe boosts, expiry cron, reminder emails) follows under its own
spec. Decisions already made for it: Stripe is built keys-later, like every
other external service.

---

## 1. Context

The site is live at gtasearch.com with real (empty) data. Everything in this
phase ships fully working the day it lands — none of it waits on external
keys, with one graceful exception: message email alerts require
`RESEND_API_KEY` and degrade silently to in-app-only until it exists.

The `Conversation`, `Message`, `SavedListing`, and `Report` models have
existed since the Phase 1 migration, built for exactly these features.
**Phase 3A requires no database migration.** If implementation finds a
missing index in practice, adding one is permitted but must follow the
migrate-create-only → deploy workflow.

## 2. Messaging

### Starting a conversation

- The listing page's "Message seller" button (disabled since Phase 1) goes
  live. Signed-out visitors are bounced to
  `/auth/signin?callbackUrl=<listing>`.
- Clicking it navigates to `/messages/new?listing=<id>`, which shows the
  listing summary and a first-message box. Sending creates the
  `Conversation` for `(listingId, buyerId)` — or reuses the existing one —
  then redirects into the thread. The schema's `@@unique([listingId,
  buyerId])` makes duplicate threads impossible.
- A seller cannot message their own listing (server-checked; the button is
  also hidden for the owner, who sees their edit controls instead).
- Conversations may reference listings that later expire, sell, or are
  deleted. The rule: **new conversations require an active listing;
  existing threads stay fully readable and replyable forever** —
  post-sale coordination is the normal case. When the listing is no
  longer active, the thread shows an informational banner ("This listing
  is no longer active") above the composer, which remains usable.

### Inbox — `/messages`

- Lists every conversation where the user is buyer or seller, ordered by
  `updatedAt` descending: listing thumbnail + title, the other person's
  first name, last message snippet (one line, truncated), relative time,
  and an unread count badge.
- The dashboard's "Messages" tab (disabled since Phase 2) becomes a link
  here. Empty state links to `/search`.

### Thread — `/messages/[conversationId]`

- Participant-only: any non-participant (including signed-out) gets
  `notFound()` — the same untraceable-404 pattern as edit pages.
- Messages render oldest→newest, sender-right/recipient-left bubbles,
  with day separators. Reply box: 1–2000 chars, server-action submit, no
  JavaScript required beyond the form (server-rendered page; posting
  redirects back to the thread).
- Opening the thread sets `readAt = now()` on all messages addressed to
  the viewer in that conversation. `Conversation.updatedAt` is bumped on
  every send (drives inbox ordering).
- Every message passes `violatesModeration()` (scams live in DMs); the
  rejection is the same generic message used at publish, never echoing
  the matched word.

### Unread badge

- The header (signed-in state) shows a count bubble on the user menu:
  `COUNT(messages WHERE recipientId = me AND readAt IS NULL)`, capped
  visually at "9+". Computed server-side per request — no polling, no
  realtime. Refreshing or navigating updates it. The inbox link inside
  the menu carries the same count.

### Email alert

- On send, if the recipient had **zero unread messages in this
  conversation before this one**, send them an email: "«FirstName» sent
  you a message about «listing title»", a one-line snippet (max ~120
  chars), and a link to the thread. Otherwise send nothing — an active
  exchange produces at most one email per conversation until the
  recipient reads it.
- Implemented as `shouldNotify(...)` logic separated from transport so it
  is unit-testable without sending anything.
- No `RESEND_API_KEY` → skip silently (spec'd degraded mode). Email
  failures never fail the message send.

### Phone reveal

- "Show phone number" on the listing page goes live for signed-in
  visitors when the seller has a phone number set; the button is absent
  entirely when they don't.
- Reveal is a server action returning the number (rendered into the
  page), rate-limited to 20 reveals/day per user to blunt scraping.
  Signed-out visitors see the button but are bounced to sign-in.

### Messaging rate limits

- 30 messages/hour per user; 10 *new* conversations/day per user. Same
  in-memory limiter as Phase 2 (Redis remains the acknowledged upgrade).

## 3. Favourites

- Heart toggle on: the listing detail page (full button, as designed in
  Phase 1) and listing cards in search/homepage grids (small icon,
  top-right over the photo).
- Toggle is a server action (`toggleSaved(listingId)`) that upserts /
  deletes the `SavedListing` row; idempotent. Signed-out → sign-in bounce
  with return to the same page. Card hearts are a small client component
  for instant visual feedback; state is server-derived on render.
- Per-page heart state is fetched as one query (the signed-in user's
  saved ids for the listings on the page), not per-card queries.
- **`/saved`** lists the user's saved listings, newest-saved first, using
  the standard card grid. Sold/expired/deleted listings remain listed but
  visibly badged (Sold / Expired / Removed) rather than silently
  vanishing — a saved item disappearing without explanation reads as a
  bug. A remove (un-heart) control appears on each card. The dashboard's
  "Saved" tab links here.

## 4. Report an ad

- "Report this ad" on the listing page (a `/coming-soon` link since
  Phase 1) opens `/listing/[id]/report` — a small form: reason radio
  (Prohibited item, Scam or fraud, Wrong category, Offensive content,
  Other) + optional details (max 500 chars).
- Anonymous reporting is allowed (`reporterId` null) — friction loses
  more reports than spam costs. Rate limit: 5 reports/day per IP;
  signed-in users additionally deduped one report per listing (a second
  attempt shows "already reported — thank you").
- Reports are stored in the existing `Report` table with `status:
  "open"`. **There is no admin screen in this phase**; review happens via
  Prisma Studio until an admin console exists. If `ADMIN_EMAIL` is set,
  each new report also sends a notification email (degraded like all
  email). `.env.example` gains `ADMIN_EMAIL` in the optional block.
- Submitting shows a confirmation page; the listing itself is untouched
  (no auto-takedown at any report count — moderation decisions stay
  human).

## 5. Security invariants

- Thread access, message send, and mark-read are participant-only,
  verified server-side on every action against the conversation row.
- A user cannot open a conversation on their own listing.
- New-conversation actions verify the listing is `active` and publicly
  visible.
- Phone numbers are never present in any payload except the explicit
  reveal action's response.
- `postalCode` remains server-only everywhere (unchanged invariant).
- All new inputs are Zod-validated; all mutations rate-limited as above.

## 6. Testing

- **Integration (live DB, self-provisioned fixtures, cleaned up after —
  the Phase 2/search-test pattern):**
  - non-participants cannot read a thread or send into it (IDOR);
  - messaging your own listing is rejected;
  - first message creates the conversation, second reuses it;
  - unread counts: send → recipient unread rises; mark-read → zero;
  - `shouldNotify` fires only when prior unread in the conversation was
    zero;
  - replies allowed in an existing thread after the listing is sold, but
    a new conversation on a sold listing is rejected;
  - favourite toggle is idempotent and `/saved` query returns badge
    states;
  - report dedupe for signed-in users; anonymous reports accepted.
- **Vitest (pure):** message/report Zod schemas against hostile input;
  snippet truncation; unread-cap display ("9+").
- **Browser:** full two-account journey — account A lists, account B
  messages, A sees badge + inbox + replies, B favourites, saves page,
  reports — at mobile and desktop widths, screenshots supplied.

## 7. Out of scope

Stripe boosts, webhooks, crons, expiry-reminder emails (Phase 3B);
realtime updates or polling; user blocking; attachment/photo messages;
admin review console; auto-takedown rules; email digests.
