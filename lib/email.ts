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

/** One email per conversation, sent only for the recipient's first unread
 *  message in the thread — see sendMessage's shouldNotify in lib/messages.ts. */
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

/** Notifies the admin inbox of a new report. Degraded mode (no Resend key)
 *  just means the report still lands in the DB — moderators can still find
 *  it via Prisma Studio; the email is a convenience, not the record. */
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
