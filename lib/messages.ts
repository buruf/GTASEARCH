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
