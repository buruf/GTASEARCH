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
      // Awaited, not fire-and-forget: on serverless (Vercel) the invocation
      // can be frozen the instant the response is sent, killing any
      // un-awaited work before it completes. sendMessageAlertEmail already
      // returns boolean and never throws; this try/catch is belt-and-braces
      // for the db lookups — an email failure must never fail the send.
      try {
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
      } catch {
        /* email must never fail the send */
      }
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
