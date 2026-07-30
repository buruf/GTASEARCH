# GTASearch Phase 3A — Engagement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buyer–seller messaging with inbox and unread badges, saved listings with heart toggles, phone-number reveal, and an anonymous-capable report-ad flow — all live on gtasearch.com.

**Architecture:** No database migration — `Conversation`, `Message`, `SavedListing`, and `Report` have existed since Phase 1. All mutation logic lives in new `lib/` modules (`messages.ts`, `saved.ts`, `reports.ts`) that server actions wrap thinly, following the Phase 2 pattern, so every rule is integration-testable without HTTP. Pages are server components; the only new client components are small forms (reply box, heart, phone reveal, report form).

**Tech Stack:** Next.js 14 App Router, Prisma 6, Zod 3, Resend (degraded when unkeyed), Vitest. No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-gtasearch-phase3a-engagement-design.md`. Phase 1/2 invariants remain binding.
- Participant-only access to threads: non-participants get `notFound()` — never a 403 that confirms existence.
- New conversations require an `active`, unexpired listing and a sender who is not the owner; existing threads stay replyable forever.
- Email alert fires only when the recipient had zero unread messages in that conversation before the new one; no `RESEND_API_KEY` → skip silently; email failure never fails the send.
- Messages pass `violatesModeration()`; rejection text is generic: "This message can't be sent as written." — never echo the matched word.
- Rate limits (in-memory `rateLimit()` as in Phase 2): messages 30/hr/user, new conversations 10/day/user, phone reveals 20/day/user, reports 5/day/IP.
- `postalCode` and phone numbers never appear in any payload except phone via the explicit reveal action.
- The live production DB is the only DB: integration tests self-provision fixtures under throwaway `vitest-*@example.com` users and delete them in `afterAll` (the `lib/search.integration.test.ts` pattern). NEVER run `npm run db:seed` or `db:reset`.
- NEVER run `prisma migrate dev` (use `npm run db:migrate` + `npm run db:deploy` only — and this plan should need no migration at all).
- Never run `npm run build` while the dev server runs (shared `.next`).
- Design system: brand greens `#2E7D32`/`#66BB6A`, `rounded-card`/`rounded-btn`, existing input/button class patterns from `components/AuthForms.tsx`.
- Windows; commands run from `C:\Users\buruf\Documents\gtasearch`. Commit after every task with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Existing interfaces used throughout: `requireUserId()`/`currentUserId()` from `@/lib/auth`; `db` from `@/lib/db`; `rateLimit(key, limit, windowMs)` from `@/lib/rate-limit`; `violatesModeration(text)` from `@/lib/moderation`; `resendEnabled()`, `appUrl()` from `@/lib/env`; `FormState` from `@/app/auth/actions`; `formatRelativeTime`, `formatPrice` from `@/lib/format`.

---

### Task 1: Validation schemas and pure helpers

**Files:**
- Modify: `lib/validation.ts` (append)
- Modify: `lib/validation.test.ts` (append)
- Modify: `lib/format.ts` (append)
- Modify: `lib/format.test.ts` (append)
- Modify: `lib/env.ts` (append)

**Interfaces:**
- Produces: `MessageSchema` (parses `{ content: string }` → trimmed 1–2000 chars); `ReportSchema` (parses `{ reason, details }`, reason ∈ REPORT_REASONS keys, details trimmed ≤500, default ""); `REPORT_REASONS: Record<string, string>`; `truncateSnippet(text: string, max?: number): string` (default max 120, single line, ellipsis); `formatUnreadCount(n: number): string | null` (null when 0, "9+" above 9); `adminEmail(): string | null` in `lib/env.ts`.

- [ ] **Step 1: Append failing tests to `lib/validation.test.ts`**

```ts
import { MessageSchema, ReportSchema } from "@/lib/validation";

describe("MessageSchema", () => {
  it("trims and accepts 1-2000 chars", () => {
    expect(MessageSchema.parse({ content: "  hi there  " }).content).toBe("hi there");
  });
  it("rejects empty and whitespace-only content", () => {
    expect(MessageSchema.safeParse({ content: "   " }).success).toBe(false);
  });
  it("rejects content over 2000 chars", () => {
    expect(MessageSchema.safeParse({ content: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("ReportSchema", () => {
  it("accepts a known reason with empty details", () => {
    const r = ReportSchema.parse({ reason: "scam", details: "" });
    expect(r.reason).toBe("scam");
    expect(r.details).toBe("");
  });
  it("rejects an unknown reason", () => {
    expect(ReportSchema.safeParse({ reason: "dislike", details: "" }).success).toBe(false);
  });
  it("rejects details over 500 chars", () => {
    expect(ReportSchema.safeParse({ reason: "other", details: "x".repeat(501) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Append failing tests to `lib/format.test.ts`**

```ts
import { truncateSnippet, formatUnreadCount } from "@/lib/format";

describe("truncateSnippet", () => {
  it("passes short text through unchanged", () => {
    expect(truncateSnippet("Is this available?")).toBe("Is this available?");
  });
  it("collapses newlines to spaces", () => {
    expect(truncateSnippet("line one\nline two")).toBe("line one line two");
  });
  it("truncates at the limit with an ellipsis", () => {
    const out = truncateSnippet("a".repeat(200), 120);
    expect(out.length).toBe(121); // 120 + ellipsis char
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("formatUnreadCount", () => {
  it("returns null for zero", () => expect(formatUnreadCount(0)).toBeNull());
  it("passes small counts through", () => expect(formatUnreadCount(4)).toBe("4"));
  it("caps at 9+", () => expect(formatUnreadCount(23)).toBe("9+"));
});
```

- [ ] **Step 3: Run to verify failures**

Run: `npx vitest run lib/validation.test.ts lib/format.test.ts`
Expected: FAIL — missing exports.

- [ ] **Step 4: Append to `lib/validation.ts`**

```ts
export const MessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write a message first")
    .max(2000, "Messages are limited to 2000 characters"),
});

/** Slug → label shown as radio options on the report form. */
export const REPORT_REASONS: Record<string, string> = {
  prohibited: "Prohibited item",
  scam: "Scam or fraud",
  "wrong-category": "Wrong category",
  offensive: "Offensive content",
  other: "Other",
};

export const ReportSchema = z.object({
  reason: z
    .string()
    .refine((r) => r in REPORT_REASONS, "Pick a reason"),
  details: z.string().trim().max(500, "Keep details under 500 characters").optional().default(""),
});
```

- [ ] **Step 5: Append to `lib/format.ts`**

```ts
/** One-line preview of a message for inboxes and alert emails. */
export function truncateSnippet(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
}

/** Unread badge text: null when nothing unread, capped display above 9. */
export function formatUnreadCount(n: number): string | null {
  if (n <= 0) return null;
  return n > 9 ? "9+" : String(n);
}
```

- [ ] **Step 6: Append to `lib/env.ts`**

```ts
/** Destination for report notifications; null disables them (degraded mode). */
export function adminEmail(): string | null {
  return process.env.ADMIN_EMAIL || null;
}
```

Also add `ADMIN_EMAIL=` (with a `# where report notifications go` comment) to the optional block of `.env.example`.

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run lib/validation.test.ts lib/format.test.ts`
Expected: PASS (all new + existing tests).

- [ ] **Step 8: Commit**

```powershell
git add lib/validation.ts lib/validation.test.ts lib/format.ts lib/format.test.ts lib/env.ts .env.example
git commit -m "Add message/report schemas and snippet/unread helpers"
```

---

### Task 2: Messaging core — `lib/messages.ts`

**Files:**
- Create: `lib/messages.ts`
- Create: `lib/messages.integration.test.ts`

**Interfaces:**
- Consumes: `db`, `violatesModeration`.
- Produces (all exported from `lib/messages.ts`):
  - `class NotParticipantError extends Error`
  - `class OwnListingError extends Error`
  - `class ListingUnavailableError extends Error`
  - `class ModerationError extends Error`
  - `getOrCreateConversation(buyerId: string, listingId: string): Promise<{ id: string; created: boolean }>` — throws `OwnListingError` when buyer owns the listing, `ListingUnavailableError` unless the listing is `active` with `expiresAt > now`.
  - `sendMessage(senderId: string, conversationId: string, content: string): Promise<{ messageId: string; recipientId: string; shouldNotify: boolean }>` — throws `NotParticipantError` / `ModerationError`; bumps `Conversation.updatedAt`; `shouldNotify` is true iff the recipient had zero unread messages in this conversation before this send.
  - `markThreadRead(userId: string, conversationId: string): Promise<void>` — throws `NotParticipantError`.
  - `unreadCountFor(userId: string): Promise<number>`
  - `listConversations(userId: string): Promise<InboxRow[]>` where `InboxRow = { id: string; listing: { id: string; title: string; images: string[]; status: string }; otherName: string; lastMessage: { content: string; createdAt: Date } | null; unread: number; updatedAt: Date }`
  - `getThread(userId: string, conversationId: string): Promise<Thread | null>` where `Thread = { id: string; listing: { id: string; title: string; status: string; expiresAt: Date; images: string[] }; otherName: string; viewerIsBuyer: boolean; messages: { id: string; content: string; senderId: string; createdAt: Date }[] }` — returns null for non-participants (page renders `notFound()`).

- [ ] **Step 1: Write the failing integration test**

`lib/messages.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  getOrCreateConversation, sendMessage, markThreadRead, unreadCountFor,
  listConversations, getThread,
  NotParticipantError, OwnListingError, ListingUnavailableError, ModerationError,
} from "@/lib/messages";

const STAMP = Date.now();
const EMAILS = {
  seller: `vitest-msg-seller-${STAMP}@example.com`,
  buyer: `vitest-msg-buyer-${STAMP}@example.com`,
  stranger: `vitest-msg-stranger-${STAMP}@example.com`,
};
let sellerId: string, buyerId: string, strangerId: string, listingId: string;

beforeAll(async () => {
  const mk = (email: string, name: string) => db.user.create({ data: { email, name } });
  sellerId = (await mk(EMAILS.seller, "Sana Seller")).id;
  buyerId = (await mk(EMAILS.buyer, "Bilal Buyer")).id;
  strangerId = (await mk(EMAILS.stranger, "Sam Stranger")).id;
  listingId = (await db.listing.create({ data: {
    title: "Messaging fixture kettle", description: "A kettle that exists so the messaging tests have something to talk about.",
    category: "furniture-home", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: sellerId,
  } })).id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: Object.values(EMAILS) } } });
  await db.$disconnect();
});

describe("getOrCreateConversation", () => {
  it("rejects messaging your own listing", async () => {
    await expect(getOrCreateConversation(sellerId, listingId)).rejects.toThrow(OwnListingError);
  });

  it("creates once, then reuses", async () => {
    const a = await getOrCreateConversation(buyerId, listingId);
    expect(a.created).toBe(true);
    const b = await getOrCreateConversation(buyerId, listingId);
    expect(b.created).toBe(false);
    expect(b.id).toBe(a.id);
  });

  it("rejects new conversations on inactive listings", async () => {
    const sold = await db.listing.create({ data: {
      title: "Sold fixture", description: "Already sold, no new conversations allowed here.",
      category: "furniture-home", city: "toronto", images: [], status: "sold",
      expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: sellerId,
    } });
    await expect(getOrCreateConversation(buyerId, sold.id)).rejects.toThrow(ListingUnavailableError);
  });
});

describe("sendMessage / unread / read", () => {
  let convoId: string;
  beforeAll(async () => {
    convoId = (await getOrCreateConversation(buyerId, listingId)).id;
  });

  it("delivers to the other participant and notifies on first unread only", async () => {
    const first = await sendMessage(buyerId, convoId, "Is the kettle still available?");
    expect(first.recipientId).toBe(sellerId);
    expect(first.shouldNotify).toBe(true);
    const second = await sendMessage(buyerId, convoId, "I can pick up tonight.");
    expect(second.shouldNotify).toBe(false); // seller already has unread
    expect(await unreadCountFor(sellerId)).toBe(2);
  });

  it("rejects non-participants", async () => {
    await expect(sendMessage(strangerId, convoId, "let me in")).rejects.toThrow(NotParticipantError);
    await expect(markThreadRead(strangerId, convoId)).rejects.toThrow(NotParticipantError);
    expect(await getThread(strangerId, convoId)).toBeNull();
  });

  it("moderates content with a generic error", async () => {
    await expect(sendMessage(buyerId, convoId, "buy my cocaine")).rejects.toThrow(ModerationError);
  });

  it("mark-read zeroes the recipient count and re-arms notification", async () => {
    await markThreadRead(sellerId, convoId);
    expect(await unreadCountFor(sellerId)).toBe(0);
    const next = await sendMessage(buyerId, convoId, "Also, does it whistle?");
    expect(next.shouldNotify).toBe(true); // unread was zero again
    await markThreadRead(sellerId, convoId);
  });

  it("replies stay allowed after the listing stops being active", async () => {
    await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
    const r = await sendMessage(sellerId, convoId, "Sold to you — see you at 6.");
    expect(r.recipientId).toBe(buyerId);
    await db.listing.update({ where: { id: listingId }, data: { status: "active" } });
  });
});

describe("inbox and thread", () => {
  it("lists the conversation for both parties with names crossed over", async () => {
    const buyerInbox = await listConversations(buyerId);
    const sellerInbox = await listConversations(sellerId);
    const b = buyerInbox.find((c) => c.listing.id === listingId)!;
    const s = sellerInbox.find((c) => c.listing.id === listingId)!;
    expect(b.otherName).toBe("Sana Seller");
    expect(s.otherName).toBe("Bilal Buyer");
    expect(b.lastMessage!.content).toContain("see you at 6");
  });

  it("getThread returns ordered messages and viewer orientation", async () => {
    const convoId = (await getOrCreateConversation(buyerId, listingId)).id;
    const t = (await getThread(buyerId, convoId))!;
    expect(t.viewerIsBuyer).toBe(true);
    expect(t.messages.length).toBeGreaterThanOrEqual(4);
    const times = t.messages.map((m) => m.createdAt.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/messages.integration.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/messages.ts`**

```ts
// Messaging core. Server actions wrap these thinly; every rule that matters —
// participant checks, own-listing rejection, moderation, the first-unread
// notification trigger — lives here where integration tests can reach it.

import { db } from "@/lib/db";
import { violatesModeration } from "@/lib/moderation";

export class NotParticipantError extends Error {
  constructor() { super("Not a participant in this conversation"); }
}
export class OwnListingError extends Error {
  constructor() { super("Cannot message your own listing"); }
}
export class ListingUnavailableError extends Error {
  constructor() { super("Listing is not available for new conversations"); }
}
export class ModerationError extends Error {
  constructor() { super("This message can't be sent as written."); }
}

export interface InboxRow {
  id: string;
  listing: { id: string; title: string; images: string[]; status: string };
  otherName: string;
  lastMessage: { content: string; createdAt: Date } | null;
  unread: number;
  updatedAt: Date;
}

export interface Thread {
  id: string;
  listing: { id: string; title: string; status: string; expiresAt: Date; images: string[] };
  otherName: string;
  viewerIsBuyer: boolean;
  messages: { id: string; content: string; senderId: string; createdAt: Date }[];
}

/** New conversations require an active, unexpired listing you don't own.
 *  Existing conversations are simply returned regardless of listing state. */
export async function getOrCreateConversation(
  buyerId: string,
  listingId: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await db.conversation.findUnique({
    where: { listingId_buyerId: { listingId, buyerId } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { userId: true, status: true, expiresAt: true },
  });
  if (!listing) throw new ListingUnavailableError();
  if (listing.userId === buyerId) throw new OwnListingError();
  if (listing.status !== "active" || listing.expiresAt <= new Date()) {
    throw new ListingUnavailableError();
  }

  const convo = await db.conversation.create({
    data: { listingId, buyerId, sellerId: listing.userId },
    select: { id: true },
  });
  return { id: convo.id, created: true };
}

async function participantConversation(userId: string, conversationId: string) {
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, buyerId: true, sellerId: true, listingId: true },
  });
  if (!convo || (convo.buyerId !== userId && convo.sellerId !== userId)) {
    throw new NotParticipantError();
  }
  return convo;
}

export async function sendMessage(
  senderId: string,
  conversationId: string,
  content: string,
): Promise<{ messageId: string; recipientId: string; shouldNotify: boolean }> {
  const convo = await participantConversation(senderId, conversationId);
  if (violatesModeration(content)) throw new ModerationError();

  const recipientId = convo.buyerId === senderId ? convo.sellerId : convo.buyerId;

  const [unreadBefore, message] = await db.$transaction([
    db.message.count({
      where: { conversationId, recipientId, readAt: null },
    }),
    db.message.create({
      data: { content, conversationId, senderId, recipientId, listingId: convo.listingId },
      select: { id: true },
    }),
    db.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
      select: { id: true },
    }),
  ]).then(([count, msg]) => [count, msg] as const);

  // One alert per conversation until the recipient reads it: notify only when
  // this message is the first unread they have in the thread.
  return { messageId: message.id, recipientId, shouldNotify: unreadBefore === 0 };
}

export async function markThreadRead(userId: string, conversationId: string): Promise<void> {
  await participantConversation(userId, conversationId);
  await db.message.updateMany({
    where: { conversationId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function unreadCountFor(userId: string): Promise<number> {
  return db.message.count({ where: { recipientId: userId, readAt: null } });
}

export async function listConversations(userId: string): Promise<InboxRow[]> {
  const convos = await db.conversation.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      updatedAt: true,
      buyerId: true,
      listing: { select: { id: true, title: true, images: true, status: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true },
      },
    },
  });

  const unreadByConvo = await db.message.groupBy({
    by: ["conversationId"],
    where: { recipientId: userId, readAt: null },
    _count: { _all: true },
  });
  const unreadMap = new Map(unreadByConvo.map((u) => [u.conversationId, u._count._all]));

  return convos.map((c) => ({
    id: c.id,
    listing: c.listing,
    otherName: c.buyerId === userId ? c.seller.name : c.buyer.name,
    lastMessage: c.messages[0] ?? null,
    unread: unreadMap.get(c.id) ?? 0,
    updatedAt: c.updatedAt,
  }));
}

export async function getThread(userId: string, conversationId: string): Promise<Thread | null> {
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      buyerId: true,
      sellerId: true,
      listing: { select: { id: true, title: true, status: true, expiresAt: true, images: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
    },
  });
  if (!convo || (convo.buyerId !== userId && convo.sellerId !== userId)) return null;

  return {
    id: convo.id,
    listing: convo.listing,
    otherName: convo.buyerId === userId ? convo.seller.name : convo.buyer.name,
    viewerIsBuyer: convo.buyerId === userId,
    messages: convo.messages,
  };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/messages.integration.test.ts` → PASS (9 tests).

- [ ] **Step 5: Commit**

```powershell
git add lib/messages.ts lib/messages.integration.test.ts
git commit -m "Add messaging core with participant guards and first-unread notify rule"
```

---

### Task 3: Messaging UI — inbox, thread, new-conversation, badge, email alert

**Files:**
- Modify: `lib/email.ts` (append `sendMessageAlertEmail`)
- Create: `app/messages/actions.ts`
- Create: `app/messages/page.tsx`
- Create: `app/messages/new/page.tsx`
- Create: `app/messages/new/NewMessageForm.tsx`
- Create: `app/messages/[conversationId]/page.tsx`
- Create: `app/messages/[conversationId]/ReplyForm.tsx`
- Modify: `components/Header.tsx` (badge)
- Modify: `components/UserMenu.tsx` (Messages item with count)
- Modify: `app/dashboard/page.tsx` (Messages tab becomes a link)
- Modify: `app/listing/[id]/page.tsx` (live "Message seller" button)
- Modify: `middleware.ts` (protect `/messages`)

**Interfaces:**
- Consumes: everything Task 2 produces; `truncateSnippet`, `formatUnreadCount` (Task 1); `sendPasswordResetEmail` pattern in `lib/email.ts`; `FormState`; `rateLimit`; `resendEnabled`, `appUrl`.
- Produces: server actions `startConversationAction(prev, formData)` (fields `listingId`, `content`) and `replyAction(prev, formData)` (fields `conversationId`, `content`); `sendMessageAlertEmail(to: string, args: { senderFirst: string; listingTitle: string; snippet: string; threadUrl: string }): Promise<boolean>`.

- [ ] **Step 1: Append to `lib/email.ts`**

```ts
export async function sendMessageAlertEmail(
  to: string,
  args: { senderFirst: string; listingTitle: string; snippet: string; threadUrl: string },
): Promise<boolean> {
  if (!resendEnabled()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "GTASearch <onboarding@resend.dev>",
      to,
      subject: `${args.senderFirst} sent you a message about "${args.listingTitle}"`,
      text: `${args.senderFirst} wrote:\n\n"${args.snippet}"\n\nReply here:\n${args.threadUrl}\n\nYou get one email per conversation until you've read it — no more.`,
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Create `app/messages/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getOrCreateConversation, sendMessage,
  OwnListingError, ListingUnavailableError, ModerationError, NotParticipantError,
} from "@/lib/messages";
import { MessageSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { truncateSnippet } from "@/lib/format";
import { sendMessageAlertEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import type { FormState } from "@/app/auth/actions";

const GENERIC: Record<string, string> = {
  moderation: "This message can't be sent as written.",
  unavailable: "This listing is no longer accepting new messages.",
  own: "You can't message your own listing.",
  limit: "You're sending messages too quickly. Try again later.",
};

async function deliver(senderId: string, conversationId: string, content: string): Promise<string | null> {
  try {
    const r = await sendMessage(senderId, conversationId, content);
    if (r.shouldNotify) {
      // Fire-and-forget: an email failure must never fail the send.
      void (async () => {
        const [recipient, sender, convo] = await Promise.all([
          db.user.findUnique({ where: { id: r.recipientId }, select: { email: true } }),
          db.user.findUnique({ where: { id: senderId }, select: { name: true } }),
          db.conversation.findUnique({ where: { id: conversationId }, select: { listing: { select: { title: true } } } }),
        ]);
        if (recipient && sender && convo) {
          await sendMessageAlertEmail(recipient.email, {
            senderFirst: sender.name.split(" ")[0],
            listingTitle: convo.listing.title,
            snippet: truncateSnippet(content),
            threadUrl: `${appUrl()}/messages/${conversationId}`,
          });
        }
      })().catch(() => {});
    }
    return null;
  } catch (e) {
    if (e instanceof ModerationError) return GENERIC.moderation;
    if (e instanceof NotParticipantError) return "This conversation isn't available.";
    throw e;
  }
}

export async function startConversationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  const parsed = MessageSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (!rateLimit(`convo:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "You've started a lot of conversations today. Try again tomorrow." };
  }
  if (!rateLimit(`msg:${userId}`, 30, 60 * 60 * 1000)) return { ok: false, error: GENERIC.limit };

  let conversationId: string;
  try {
    conversationId = (await getOrCreateConversation(userId, listingId)).id;
  } catch (e) {
    if (e instanceof OwnListingError) return { ok: false, error: GENERIC.own };
    if (e instanceof ListingUnavailableError) return { ok: false, error: GENERIC.unavailable };
    throw e;
  }

  const err = await deliver(userId, conversationId, parsed.data.content);
  if (err) return { ok: false, error: err };
  redirect(`/messages/${conversationId}`);
}

export async function replyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const conversationId = String(formData.get("conversationId") ?? "");
  const parsed = MessageSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!rateLimit(`msg:${userId}`, 30, 60 * 60 * 1000)) return { ok: false, error: GENERIC.limit };

  const err = await deliver(userId, conversationId, parsed.data.content);
  if (err) return { ok: false, error: err };
  redirect(`/messages/${conversationId}`);
}
```

- [ ] **Step 3: Create the inbox — `app/messages/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { requireUserId } from "@/lib/auth";
import { listConversations } from "@/lib/messages";
import { formatRelativeTime, formatUnreadCount, truncateSnippet } from "@/lib/format";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default async function MessagesPage() {
  const userId = await requireUserId();
  const rows = await listConversations(userId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Messages</h1>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-card border border-line bg-surface-alt px-6 py-12 text-center">
          <p className="font-semibold text-ink">No conversations yet</p>
          <p className="mt-2 text-sm text-ink-muted">
            Find something you like and message the seller — replies land here.
          </p>
          <Link href="/search" className="mt-4 inline-block rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
            Browse listings
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
          {rows.map((c) => {
            const badge = formatUnreadCount(c.unread);
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-alt">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-btn bg-surface-alt">
                    {c.listing.images[0] && (
                      <Image src={c.listing.images[0]} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${badge ? "font-bold text-ink" : "font-medium text-ink"}`}>
                      {c.otherName}
                      <span className="font-normal text-ink-muted"> · {c.listing.title}</span>
                    </p>
                    <p className="truncate text-sm text-ink-muted">
                      {c.lastMessage ? truncateSnippet(c.lastMessage.content, 80) : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <time className="text-xs text-ink-faint">{formatRelativeTime(c.updatedAt)}</time>
                    {badge && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{badge}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create the thread page — `app/messages/[conversationId]/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getThread, markThreadRead } from "@/lib/messages";
import { formatRelativeTime } from "@/lib/format";
import { ReplyForm } from "./ReplyForm";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };

export default async function ThreadPage({ params }: { params: { conversationId: string } }) {
  const userId = await requireUserId();
  const thread = await getThread(userId, params.conversationId);
  if (!thread) notFound();

  // Viewing the thread is what "reading" means.
  await markThreadRead(userId, params.conversationId);

  const inactive = thread.listing.status !== "active" || thread.listing.expiresAt <= new Date();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/messages" className="text-sm text-brand hover:underline">← All messages</Link>

      <div className="mt-3 rounded-card border border-line bg-surface p-3">
        <p className="text-sm text-ink-muted">
          Conversation with <strong className="text-ink">{thread.otherName}</strong> about{" "}
          <Link href={`/listing/${thread.listing.id}`} className="font-medium text-brand hover:underline">
            {thread.listing.title}
          </Link>
        </p>
      </div>

      {inactive && (
        <p className="mt-3 rounded-card bg-surface-alt px-4 py-2.5 text-sm text-ink-muted">
          This listing is no longer active. You can still reply to coordinate.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {thread.messages.map((m) => {
          const mine = m.senderId === userId;
          return (
            <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[80%] rounded-card px-3 py-2 ${mine ? "bg-brand text-white" : "bg-surface-alt text-ink"}`}>
                <p className="whitespace-pre-line break-words text-sm">{m.content}</p>
                <time className={`mt-1 block text-right text-[11px] ${mine ? "text-white/70" : "text-ink-faint"}`}>
                  {formatRelativeTime(m.createdAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <ReplyForm conversationId={thread.id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `app/messages/[conversationId]/ReplyForm.tsx`**

```tsx
"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { replyAction } from "@/app/messages/actions";
import type { FormState } from "@/app/auth/actions";

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="h-11 shrink-0 rounded-btn bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? "Sending…" : "Send"}
    </button>
  );
}

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(replyAction, { ok: false });
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex gap-2">
        <textarea
          name="content" required maxLength={2000} rows={2}
          placeholder="Write a message…"
          className="w-full rounded-btn border border-line p-3 text-sm focus:border-brand"
        />
        <Send />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 6: Create `app/messages/new/page.tsx` + `NewMessageForm.tsx`**

`page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getPublicListing } from "@/lib/listing";
import { getOrCreateConversation } from "@/lib/messages";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { NewMessageForm } from "./NewMessageForm";

export const metadata: Metadata = { title: "New message", robots: { index: false } };

export default async function NewMessagePage({
  searchParams,
}: { searchParams: { listing?: string } }) {
  const userId = await requireUserId();
  const listing = await getPublicListing(searchParams.listing ?? "");
  if (!listing) notFound();
  if (listing.user.id === userId) redirect(`/listing/${listing.id}`);

  // Already talking? Jump straight into the thread instead of a blank form.
  const existing = await db.conversation.findUnique({
    where: { listingId_buyerId: { listingId: listing.id, buyerId: userId } },
    select: { id: true },
  });
  if (existing) redirect(`/messages/${existing.id}`);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Message the seller</h1>
      <div className="mt-3 rounded-card border border-line bg-surface p-3 text-sm">
        <Link href={`/listing/${listing.id}`} className="font-medium text-brand hover:underline">
          {listing.title}
        </Link>
        <span className="text-ink-muted"> · {formatPrice(listing.price, listing.priceType)} · {listing.user.name}</span>
      </div>
      <div className="mt-4">
        <NewMessageForm listingId={listing.id} />
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        Stay safe: keep the conversation on GTASearch, meet in public, and never send deposits.
      </p>
    </div>
  );
}
```

`NewMessageForm.tsx` — same shape as `ReplyForm` but posting `startConversationAction` with hidden `listingId`, a 4-row textarea placeholder "Hi, is this still available?", and the submit labelled "Send message".

- [ ] **Step 7: Wire the listing page button** — in `app/listing/[id]/page.tsx`, replace the disabled "Message seller" button. The page already knows the viewer (`currentUserId()` — add if absent) and the seller:

```tsx
{viewerId === listing.user.id ? (
  <Link href={`/listing/${listing.id}/edit`} className="block w-full rounded-btn bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-dark">
    Edit your listing
  </Link>
) : (
  <Link
    href={viewerId ? `/messages/new?listing=${listing.id}` : `/auth/signin?callbackUrl=${encodeURIComponent(`/messages/new?listing=${listing.id}`)}`}
    className="block w-full rounded-btn bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-dark"
  >
    Message seller
  </Link>
)}
```

- [ ] **Step 8: Header badge + menu item + dashboard tab + middleware**

- `components/Header.tsx`: alongside the session fetch, `const unread = session?.user ? await unreadCountFor(session.user.id) : 0;` and pass `unread` to `<UserMenu name={…} unread={unread} />`.
- `components/UserMenu.tsx`: accept `unread: number`; import `formatUnreadCount` from `@/lib/format`; render the badge on the trigger (`{name} ▾` gains a `<span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">{badgeText}</span>` when non-null) and add a "Messages" item above Dashboard linking `/messages` showing the same badge.
- `app/dashboard/page.tsx`: the disabled "Messages" chip becomes `<Link href="/messages" …>Messages</Link>` styled like the active tab links.
- `middleware.ts`: add `"/messages/:path*", "/messages"` to the matcher array.

- [ ] **Step 9: Verify in browser** — with the dev server running: sign in, open a listing you don't own (create one with a second account if needed), Message seller → form → send → land in thread; reply as the other account; badge counts rise and clear on read. Confirm signed-out "Message seller" bounces to signin and a stranger's thread URL 404s.

- [ ] **Step 10: Full suite + commit**

```powershell
npx vitest run
git add lib/email.ts app/messages components/Header.tsx components/UserMenu.tsx app/dashboard/page.tsx app/listing/[id]/page.tsx middleware.ts
git commit -m "Add messaging UI: inbox, threads, unread badges, first-unread email alerts"
```

---

### Task 4: Phone reveal

**Files:**
- Create: `components/PhoneReveal.tsx`
- Create: `app/listing/[id]/phone-actions.ts`
- Modify: `app/listing/[id]/page.tsx` (replace disabled "Show phone number")

**Interfaces:**
- Consumes: `currentUserId`, `db`, `rateLimit`, `FormState`.
- Produces: `revealPhoneAction(prev: FormState & { phone?: string }, formData)` with hidden field `listingId`.

- [ ] **Step 1: Create `app/listing/[id]/phone-actions.ts`**

```ts
"use server";

import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export type PhoneState = { ok: boolean; phone?: string; error?: string };

export async function revealPhoneAction(_prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const userId = await requireUserId();
  if (!rateLimit(`phone:${userId}`, 20, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Daily reveal limit reached." };
  }
  const listing = await db.listing.findFirst({
    where: { id: String(formData.get("listingId") ?? ""), status: "active", expiresAt: { gt: new Date() } },
    select: { user: { select: { phone: true } } },
  });
  if (!listing?.user.phone) return { ok: false, error: "No phone number on this listing." };
  return { ok: true, phone: listing.user.phone };
}
```

- [ ] **Step 2: Create `components/PhoneReveal.tsx`**

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { revealPhoneAction, type PhoneState } from "@/app/listing/[id]/phone-actions";

function RevealButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="w-full rounded-btn border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-50 disabled:opacity-60">
      {pending ? "…" : "Show phone number"}
    </button>
  );
}

export function PhoneReveal({ listingId }: { listingId: string }) {
  const [state, formAction] = useFormState<PhoneState, FormData>(revealPhoneAction, { ok: false });

  if (state.ok && state.phone) {
    return (
      <a href={`tel:${state.phone}`}
        className="block w-full rounded-btn border border-brand px-4 py-2.5 text-center text-sm font-bold text-brand">
        {state.phone}
      </a>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <RevealButton />
      {state.error && <p role="alert" className="mt-1 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Wire into the listing page** — in the seller card of `app/listing/[id]/page.tsx`: the seller's phone must NOT be fetched into the page payload. `getPublicListing` in `lib/listing.ts` currently selects `user.phone` — change that select to `phone: true` → **remove it**, replacing with a boolean: add `hasPhone` computed server-side:

In `lib/listing.ts`, replace `phone: true` inside the user select with nothing, and instead select it into a local and expose only a boolean:

```ts
// user select: { id: true, name: true, createdAt: true, phone: true } →
// keep phone in the query but return only a boolean flag:
return {
  ...listing,
  user: { id: listing.user.id, name: listing.user.name, createdAt: listing.user.createdAt },
  hasPhone: Boolean(listing.user.phone),
  activeAds,
  isFeatured,
};
```

Then in the page, for non-owner viewers: `{viewerId && listing.hasPhone ? <PhoneReveal listingId={listing.id} /> : !viewerId && listing.hasPhone ? <Link href={signinUrl} …>Show phone number</Link> : null}` — the button is absent entirely when the seller has no phone.

- [ ] **Step 4: Verify in browser** — seller with phone set (add via dashboard settings): signed-in non-owner sees button, click reveals `tel:` link; seller without phone: no button; page HTML (view-source) contains no phone number before reveal.

- [ ] **Step 5: Full suite + commit**

```powershell
npx vitest run
git add components/PhoneReveal.tsx app/listing lib/listing.ts
git commit -m "Add rate-limited phone reveal without phone numbers in page payloads"
```

---

### Task 5: Favourites

**Files:**
- Create: `lib/saved.ts`
- Create: `lib/saved.integration.test.ts`
- Create: `app/saved/actions.ts`
- Create: `app/saved/page.tsx`
- Create: `components/SaveHeart.tsx`
- Modify: `components/ListingCard.tsx` (optional heart overlay)
- Modify: `app/page.tsx`, `app/search/page.tsx` (pass saved ids)
- Modify: `app/listing/[id]/page.tsx` (replace disabled "Save to favourites")
- Modify: `app/dashboard/page.tsx` (Saved tab becomes a link)
- Modify: `middleware.ts` (protect `/saved`)

**Interfaces:**
- Consumes: `currentUserId`, `requireUserId`, `db`, `ListingRow`.
- Produces: `toggleSaved(userId, listingId): Promise<{ saved: boolean }>`; `savedIdsFor(userId, listingIds: string[]): Promise<string[]>`; `savedListingsFor(userId): Promise<(ListingRow & { savedAt: Date; displayStatus: "active" | "sold" | "expired" | "removed" })[]>`; server action `toggleSavedAction(formData)` with fields `listingId`, `returnTo`; component `<SaveHeart listingId saved variant="card" | "full" />`.

- [ ] **Step 1: Write failing integration test**

`lib/saved.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { toggleSaved, savedIdsFor, savedListingsFor } from "@/lib/saved";

const STAMP = Date.now();
const EMAILS = [`vitest-sav-owner-${STAMP}@example.com`, `vitest-sav-fan-${STAMP}@example.com`];
let ownerId: string, fanId: string, listingId: string;

beforeAll(async () => {
  ownerId = (await db.user.create({ data: { email: EMAILS[0], name: "Owner" } })).id;
  fanId = (await db.user.create({ data: { email: EMAILS[1], name: "Fan" } })).id;
  listingId = (await db.listing.create({ data: {
    title: "Saveable fixture chair", description: "A chair whose only purpose is to be saved by tests.",
    category: "furniture-home", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: ownerId,
  } })).id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  await db.$disconnect();
});

describe("favourites", () => {
  it("toggles on, then off, idempotently", async () => {
    expect((await toggleSaved(fanId, listingId)).saved).toBe(true);
    expect(await savedIdsFor(fanId, [listingId])).toEqual([listingId]);
    expect((await toggleSaved(fanId, listingId)).saved).toBe(false);
    expect(await savedIdsFor(fanId, [listingId])).toEqual([]);
  });

  it("saved page rows carry honest display status", async () => {
    await toggleSaved(fanId, listingId);
    await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
    const rows = await savedListingsFor(fanId);
    const row = rows.find((r) => r.id === listingId)!;
    expect(row.displayStatus).toBe("sold");
    await db.listing.update({ where: { id: listingId }, data: { status: "active" } });
  });

  it("savedIdsFor only reports ids from the requested set", async () => {
    expect(await savedIdsFor(fanId, ["nonexistent-id"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/saved.integration.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/saved.ts`**

```ts
import { db } from "@/lib/db";

export async function toggleSaved(
  userId: string,
  listingId: string,
): Promise<{ saved: boolean }> {
  const key = { userId_listingId: { userId, listingId } };
  const existing = await db.savedListing.findUnique({ where: key });
  if (existing) {
    await db.savedListing.delete({ where: key });
    return { saved: false };
  }
  try {
    await db.savedListing.create({ data: { userId, listingId } });
  } catch (e) {
    // P2003: listing vanished between render and click. Treat as unsaved.
    if ((e as { code?: string }).code === "P2003") return { saved: false };
    throw e;
  }
  return { saved: true };
}

/** Which of these listings has the user saved? One query per page render. */
export async function savedIdsFor(userId: string, listingIds: string[]): Promise<string[]> {
  if (listingIds.length === 0) return [];
  const rows = await db.savedListing.findMany({
    where: { userId, listingId: { in: listingIds } },
    select: { listingId: true },
  });
  return rows.map((r) => r.listingId);
}

export type SavedDisplayStatus = "active" | "sold" | "expired" | "removed";

/** The /saved page: sold/expired/deleted items stay listed, honestly badged —
 *  a saved item silently vanishing reads as a bug. */
export async function savedListingsFor(userId: string) {
  const rows = await db.savedListing.findMany({
    where: { userId },
    orderBy: { savedAt: "desc" },
    select: {
      savedAt: true,
      listing: {
        select: {
          id: true, title: true, price: true, priceType: true, category: true,
          subcategory: true, city: true, neighbourhood: true, images: true,
          boostLevel: true, boostExpiresAt: true, createdAt: true, views: true,
          status: true, expiresAt: true,
        },
      },
    },
  });

  return rows.map(({ savedAt, listing }) => {
    let displayStatus: SavedDisplayStatus;
    if (listing.status === "deleted") displayStatus = "removed";
    else if (listing.status === "sold") displayStatus = "sold";
    else if (listing.status !== "active" || listing.expiresAt <= new Date()) displayStatus = "expired";
    else displayStatus = "active";
    const boostLive = listing.boostExpiresAt !== null && listing.boostExpiresAt > new Date();
    return {
      ...listing,
      effectiveBoost: boostLive && listing.boostLevel === "super" ? 0
        : boostLive && listing.boostLevel === "featured" ? 1
        : boostLive && listing.boostLevel === "top" ? 2 : 3,
      savedAt,
      displayStatus,
    };
  });
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/saved.integration.test.ts` → PASS (3 tests).

- [ ] **Step 5: Create `app/saved/actions.ts`**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { toggleSaved } from "@/lib/saved";

export async function toggleSavedAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  if (listingId) await toggleSaved(userId, listingId);
  revalidatePath("/saved");
  // Progressive enhancement: without JS the form navigates; send them back.
  if (returnTo.startsWith("/")) redirect(returnTo);
}
```

- [ ] **Step 6: Create `components/SaveHeart.tsx`**

```tsx
"use client";

import { useOptimistic } from "react";
import { toggleSavedAction } from "@/app/saved/actions";

export function SaveHeart({
  listingId, saved, returnTo, variant = "card",
}: { listingId: string; saved: boolean; returnTo: string; variant?: "card" | "full" }) {
  const [optimistic, flip] = useOptimistic(saved, (s) => !s);

  const heart = (
    <svg viewBox="0 0 24 24" className={variant === "card" ? "h-5 w-5" : "h-5 w-5"}
      fill={optimistic ? "#2E7D32" : "none"} stroke={optimistic ? "#2E7D32" : "currentColor"}
      strokeWidth="2" aria-hidden="true">
      <path d="M12 21C7 16.5 3 13.2 3 9.3 3 6.9 4.9 5 7.3 5c1.6 0 3.1.8 4 2.1L12 8l.7-.9c.9-1.3 2.4-2.1 4-2.1C19.1 5 21 6.9 21 9.3c0 3.9-4 7.2-9 11.7z" />
    </svg>
  );

  return (
    <form action={async (fd) => { flip(saved); await toggleSavedAction(fd); }}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {variant === "card" ? (
        <button type="submit" aria-label={optimistic ? "Remove from favourites" : "Save to favourites"}
          className="rounded-full bg-white/90 p-1.5 text-ink-muted shadow-sm hover:text-brand">
          {heart}
        </button>
      ) : (
        <button type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-btn border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
          {heart}
          {optimistic ? "Saved" : "Save to favourites"}
        </button>
      )}
    </form>
  );
}
```

- [ ] **Step 7: Card overlay + page wiring**

- `components/ListingCard.tsx`: add optional props `saved?: boolean` and `returnTo?: string` to `ListingCard`; when `saved !== undefined`, render `<div className="absolute right-2 top-2 z-10"><SaveHeart listingId={listing.id} saved={saved} returnTo={returnTo ?? "/"} variant="card" /></div>` inside the image wrapper (the article is already `relative`). `ListingGrid` gains optional `savedIds?: string[]` and `returnTo?: string`, passing `saved={savedIds ? savedIds.includes(l.id) : undefined}`.
- `app/page.tsx` and `app/search/page.tsx`: fetch `const viewerId = await currentUserId();` then `const savedIds = viewerId ? await savedIdsFor(viewerId, allRowIds) : undefined;` (ids from the rows already fetched, one call covering both homepage sections) and pass `savedIds`/`returnTo` into the grids. Signed-out visitors get no hearts (undefined) — the detail-page button is their entry point.
- `app/listing/[id]/page.tsx`: replace the disabled "♥ Save to favourites" with signed-in → `<SaveHeart listingId={listing.id} saved={isSaved} returnTo={`/listing/${listing.id}`} variant="full" />` (`isSaved` from `savedIdsFor(viewerId, [listing.id])`), signed-out → link to signin with callback.

- [ ] **Step 8: Create `app/saved/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { savedListingsFor } from "@/lib/saved";
import { ListingCard } from "@/components/ListingCard";

export const metadata: Metadata = { title: "Saved listings", robots: { index: false } };

const BADGE: Record<string, { label: string; cls: string }> = {
  sold: { label: "Sold", cls: "bg-surface-alt text-ink-muted" },
  expired: { label: "Expired", cls: "bg-amber-50 text-amber-700" },
  removed: { label: "Removed", cls: "bg-surface-alt text-ink-faint" },
};

export default async function SavedPage() {
  const userId = await requireUserId();
  const rows = await savedListingsFor(userId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Saved listings</h1>
      {rows.length === 0 ? (
        <div className="mt-8 rounded-card border border-line bg-surface-alt px-6 py-12 text-center">
          <p className="font-semibold text-ink">Nothing saved yet</p>
          <p className="mt-2 text-sm text-ink-muted">Tap the heart on any listing to keep it here.</p>
          <Link href="/search" className="mt-4 inline-block rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
            Browse listings
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.id} className="relative">
              {r.displayStatus !== "active" && (
                <span className={`absolute left-2 top-2 z-10 rounded-btn px-2 py-0.5 text-xs font-semibold ${BADGE[r.displayStatus].cls}`}>
                  {BADGE[r.displayStatus].label}
                </span>
              )}
              <ListingCard listing={r} saved={true} returnTo="/saved" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Dashboard Saved tab → link; middleware matcher gains `"/saved"`.**

- [ ] **Step 10: Verify in browser** — heart a listing from search (fills instantly), see it on `/saved`; un-heart from the saved page (disappears after revalidation); mark the listing sold from the dashboard and confirm the Saved page badges it Sold; signed-out cards show no hearts.

- [ ] **Step 11: Full suite + commit**

```powershell
npx vitest run
git add lib/saved.ts lib/saved.integration.test.ts app/saved components/SaveHeart.tsx components/ListingCard.tsx app/page.tsx app/search/page.tsx app/listing/[id]/page.tsx app/dashboard/page.tsx middleware.ts
git commit -m "Add favourites: heart toggles, saved page with honest status badges"
```

---

### Task 6: Report an ad

**Files:**
- Create: `lib/reports.ts`
- Create: `lib/reports.integration.test.ts`
- Create: `app/listing/[id]/report/page.tsx`
- Create: `app/listing/[id]/report/ReportForm.tsx`
- Create: `app/listing/[id]/report/actions.ts`
- Modify: `lib/email.ts` (append `sendReportEmail`)
- Modify: `app/listing/[id]/page.tsx` ("Report this ad" link → `/listing/[id]/report`)

**Interfaces:**
- Consumes: `currentUserId` (nullable — anonymous allowed), `db`, `ReportSchema`, `REPORT_REASONS`, `rateLimit`, `adminEmail`, `resendEnabled`.
- Produces: `createReport(reporterId: string | null, listingId: string, reason: string, details: string): Promise<{ ok: true; duplicate: boolean }>` (duplicate=true when a signed-in reporter already reported this listing — no second row written); `sendReportEmail(to, args: { listingId, listingTitle, reason, details }): Promise<boolean>`; server action `submitReportAction`.

- [ ] **Step 1: Write failing integration test**

`lib/reports.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createReport } from "@/lib/reports";

const STAMP = Date.now();
const EMAILS = [`vitest-rep-owner-${STAMP}@example.com`, `vitest-rep-user-${STAMP}@example.com`];
let ownerId: string, reporterId: string, listingId: string;

beforeAll(async () => {
  ownerId = (await db.user.create({ data: { email: EMAILS[0], name: "Owner" } })).id;
  reporterId = (await db.user.create({ data: { email: EMAILS[1], name: "Reporter" } })).id;
  listingId = (await db.listing.create({ data: {
    title: "Reportable fixture", description: "A listing that exists to be reported by the test suite.",
    category: "electronics", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: ownerId,
  } })).id;
});

afterAll(async () => {
  await db.report.deleteMany({ where: { listingId } });
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  await db.$disconnect();
});

describe("createReport", () => {
  it("stores an anonymous report", async () => {
    const r = await createReport(null, listingId, "scam", "asked for e-transfer deposit");
    expect(r).toEqual({ ok: true, duplicate: false });
    const row = await db.report.findFirst({ where: { listingId, reporterId: null } });
    expect(row!.status).toBe("open");
  });

  it("dedupes signed-in reporters per listing", async () => {
    expect(await createReport(reporterId, listingId, "offensive", "")).toEqual({ ok: true, duplicate: false });
    expect(await createReport(reporterId, listingId, "scam", "second try")).toEqual({ ok: true, duplicate: true });
    expect(await db.report.count({ where: { listingId, reporterId } })).toBe(1);
  });

  it("anonymous reports are never deduped against each other", async () => {
    await createReport(null, listingId, "other", "");
    expect(await db.report.count({ where: { listingId, reporterId: null } })).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run lib/reports.integration.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/reports.ts`**

```ts
import { db } from "@/lib/db";

/** Stores a report. Signed-in reporters are deduped per listing (their second
 *  report is acknowledged but not stored); anonymous reports are always
 *  stored — IP-level abuse is the rate limiter's job, not the database's. */
export async function createReport(
  reporterId: string | null,
  listingId: string,
  reason: string,
  details: string,
): Promise<{ ok: true; duplicate: boolean }> {
  if (reporterId) {
    const existing = await db.report.findFirst({
      where: { listingId, reporterId },
      select: { id: true },
    });
    if (existing) return { ok: true, duplicate: true };
  }
  await db.report.create({
    data: { listingId, reporterId, reason, details: details || null },
  });
  return { ok: true, duplicate: false };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run lib/reports.integration.test.ts` → PASS (3 tests).

- [ ] **Step 5: Append `sendReportEmail` to `lib/email.ts`**

```ts
export async function sendReportEmail(
  to: string,
  args: { listingId: string; listingTitle: string; reason: string; details: string },
): Promise<boolean> {
  if (!resendEnabled()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "GTASearch <onboarding@resend.dev>",
      to,
      subject: `Listing reported: ${args.listingTitle}`,
      text: `Reason: ${args.reason}\nDetails: ${args.details || "(none)"}\n\nListing: ${process.env.NEXTAUTH_URL ?? ""}/listing/${args.listingId}\n\nReview in Prisma Studio (Report table).`,
    });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Create `app/listing/[id]/report/actions.ts`**

```ts
"use server";

import { headers } from "next/headers";
import { currentUserId } from "@/lib/auth";
import { getPublicListing } from "@/lib/listing";
import { createReport } from "@/lib/reports";
import { ReportSchema, REPORT_REASONS } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { sendReportEmail } from "@/lib/email";
import { adminEmail } from "@/lib/env";
import type { FormState } from "@/app/auth/actions";

export async function submitReportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`report:${ip}`, 5, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Too many reports today. Try again tomorrow." };
  }

  const listingId = String(formData.get("listingId") ?? "");
  const listing = await getPublicListing(listingId);
  if (!listing) return { ok: false, error: "This listing no longer exists." };

  const parsed = ReportSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const reporterId = await currentUserId();
  const { duplicate } = await createReport(reporterId, listingId, parsed.data.reason, parsed.data.details);

  if (!duplicate) {
    const to = adminEmail();
    if (to) {
      void sendReportEmail(to, {
        listingId,
        listingTitle: listing.title,
        reason: REPORT_REASONS[parsed.data.reason] ?? parsed.data.reason,
        details: parsed.data.details,
      }).catch(() => {});
    }
  }
  // Duplicate and fresh both land on the same thank-you: nothing to probe.
  return { ok: true };
}
```

- [ ] **Step 7: Create the page and form**

`app/listing/[id]/report/page.tsx`: server component — `getPublicListing(params.id)` or `notFound()`; heading "Report this ad", the listing title as context, then `<ReportForm listingId={listing.id} />`, `robots: { index: false }`.

`ReportForm.tsx` (client): `useFormState(submitReportAction, { ok: false })`. On `state.ok` render the thank-you: "Thanks — our team will take a look. Reports are anonymous to the seller." with a link back to the listing. Otherwise: hidden `listingId`, radios from `REPORT_REASONS` (`Object.entries`, first one `defaultChecked`), a 3-row optional details textarea (maxLength 500), errors in red, submit button "Send report".

- [ ] **Step 8: Wire the listing page link** — in `app/listing/[id]/page.tsx`, point the existing "Report this ad" link at `/listing/${listing.id}/report` (it currently points at `/coming-soon`).

- [ ] **Step 9: Verify in browser** — report a listing signed-out (works), signed-in twice (second gets the same thank-you; DB holds one row — check via `npx prisma studio` or a quick count), confirm the form 404s for a nonexistent listing.

- [ ] **Step 10: Full suite + commit**

```powershell
npx vitest run
git add lib/reports.ts lib/reports.integration.test.ts app/listing lib/email.ts
git commit -m "Add report-ad flow: anonymous-capable, deduped, admin email optional"
```

---

### Task 7: Final verification, docs, deploy

**Files:**
- Modify: `README.md` (Phase 3A section)

- [ ] **Step 1: Full suite** — `npx vitest run` → all green (~125+ tests).

- [ ] **Step 2: Production build** — stop the dev server first, then `npm run build` → compiles clean; restart dev server after (delete `.next` if it complains).

- [ ] **Step 3: Two-account browser journey** at 375px and 1280px: account A posts a listing; account B messages it (badge appears for A), A replies from the inbox, B favourites it, checks `/saved`, reveals the phone (set one on A first), reports the listing. Screenshots of inbox, thread, saved page shared with the user.

- [ ] **Step 4: Guard checks** — thread URL from a third account → 404; signed-out `/messages` → signin bounce; listing page HTML contains no phone number pre-reveal; `postalCode` still absent from all public payloads.

- [ ] **Step 5: README** — Phase status line gains "Phase 3A (messaging, favourites, reporting): DONE — see spec"; note `ADMIN_EMAIL` in the env table; one line: "Messaging rules live in `lib/messages.ts`; the first-unread email trigger is `shouldNotify` on `sendMessage`."

- [ ] **Step 6: Commit + push (deploys to gtasearch.com)**

```powershell
npx vitest run
git add README.md
git commit -m "Verify Phase 3A end to end and document"
git push origin master
```

- [ ] **Step 7: Live verification** — after the Vercel deploy window (~2.5 min): fetch `https://www.gtasearch.com/messages` (expect signin redirect), a listing page (expect Message seller button in HTML), and confirm no 500s in the deployment. Report results to the user.

---

## Self-review notes

- **Spec coverage:** §2 messaging → Tasks 2–3 (start/inbox/thread/badge/email/limits), banner rule in Task 3 Step 4, phone reveal §2 → Task 4. §3 favourites → Task 5 (hearts, one-query state, `/saved` badges). §4 reports → Task 6 (anonymous, dedupe, ADMIN_EMAIL, no auto-takedown — nothing auto-actions reports anywhere). §5 invariants → participant guards (Task 2 tests), phone payload removal (Task 4 Step 3), rate limits per constraint block. §6 testing → per-task + Task 7 journey. §7 out-of-scope respected — no polling, no blocking, no admin UI.
- **Type consistency:** `FormState` reused from `app/auth/actions`; `PhoneState` local to phone-actions; `InboxRow`/`Thread` defined in Task 2 and consumed in Task 3; `savedListingsFor` returns card-compatible rows (includes `effectiveBoost`) for `ListingCard`.
- **No migration confirmed:** every query uses existing columns and the existing `@@unique([listingId, buyerId])` and PK constraints.
