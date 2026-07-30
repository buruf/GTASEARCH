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
