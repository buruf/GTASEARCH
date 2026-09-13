import { Resend } from "resend";
import { emailEnabled } from "@/lib/env";

const FROM_FALLBACK = "GTASearch <onboarding@resend.dev>";

function emailFrom(): string {
  return process.env.EMAIL_FROM ?? FROM_FALLBACK;
}

/** Splits `Name <addr@example.com>`; a bare address gets no display name. */
function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<\s*(.+?)\s*>\s*$/);
  if (match && match[2]) {
    return match[1] ? { name: match[1], email: match[2] } : { email: match[2] };
  }
  return { email: from.trim() };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** One transport for every mail this app sends. All our emails are plain
 *  text; Brevo requires an HTML body, so the text is wrapped verbatim.
 *  Provider is picked by env var — BREVO_API_KEY first, RESEND_API_KEY as
 *  the legacy fallback — so switching providers is a Vercel env change. */
async function deliver(to: string, subject: string, text: string): Promise<boolean> {
  try {
    const brevoKey = process.env.BREVO_API_KEY;
    if (brevoKey) {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: parseFrom(emailFrom()),
          to: [{ email: to }],
          subject,
          textContent: text,
          htmlContent: `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(text)}</div>`,
        }),
      });
      return res.ok;
    }
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: emailFrom(), to, subject, text });
    return true;
  } catch {
    return false;
  }
}

/** Returns false when email is unconfigured (degraded mode) or sending fails.
 *  Callers surface "email isn't configured" honestly — never a fake success. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  if (!emailEnabled()) return false;
  return deliver(
    to,
    "Reset your GTASearch password",
    `Someone requested a password reset for your GTASearch account.\n\nReset it here (link valid for 1 hour):\n${resetUrl}\n\nIf this wasn't you, ignore this email — your password is unchanged.`,
  );
}

/**
 * Confirms a newly registered address actually reaches the person.
 *
 * Deliberately spells out what the account cannot do yet, rather than only
 * "click here": somebody who ignores this and comes back next week to post an
 * ad should be able to work out why they are being stopped.
 */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<boolean> {
  if (!emailEnabled()) return false;
  return deliver(
    to,
    "Confirm your email for GTASearch",
    `Welcome to GTASearch.\n\nConfirm this address to finish setting up your account (link valid for 24 hours):\n${verifyUrl}\n\nUntil you do you can browse and sign in, but you won't be able to post an ad, message a seller, claim a business or leave a review.\n\nIf you didn't create this account, ignore this email — nothing was set up.`,
  );
}

/** One email per conversation, sent only for the recipient's first unread
 *  message in the thread — see sendMessage's shouldNotify in lib/messages.ts. */
export async function sendMessageAlertEmail(
  to: string,
  args: { senderFirst: string; listingTitle: string; snippet: string; threadUrl: string },
): Promise<boolean> {
  if (!emailEnabled()) return false;
  return deliver(
    to,
    `${args.senderFirst} sent you a message about "${args.listingTitle}"`,
    `${args.senderFirst} wrote:\n\n"${args.snippet}"\n\nReply here:\n${args.threadUrl}\n\nYou get one email per conversation until you've read it — no more.`,
  );
}

/** Notifies the admin inbox of a new report. Degraded mode (no provider key)
 *  just means the report still lands in the DB — moderators can still find
 *  it via Prisma Studio; the email is a convenience, not the record. */
export async function sendReportEmail(
  to: string,
  args: { listingId: string; listingTitle: string; reason: string; details: string },
): Promise<boolean> {
  if (!emailEnabled()) return false;
  return deliver(
    to,
    `Listing reported: ${args.listingTitle}`,
    `Reason: ${args.reason}\nDetails: ${args.details || "(none)"}\n\nListing: ${process.env.NEXTAUTH_URL ?? ""}/listing/${args.listingId}\n\nReview in Prisma Studio (Report table).`,
  );
}

/** Tells the admin a claim is waiting. Claims are reviewed by hand, so without
 *  this the queue is only found by remembering to look — while a business
 *  owner sits waiting on it. */
export async function sendClaimSubmittedEmail(
  to: string,
  args: {
    businessName: string; businessAddress: string; claimantName: string;
    claimantEmail: string; role: string; evidence: string;
  },
): Promise<boolean> {
  if (!emailEnabled()) return false;
  return deliver(
    to,
    `Claim submitted: ${args.businessName}`,
    // The "Sign in as" line is not a nicety. /admin/claims calls requireAdmin(),
    // which returns a bare 404 — deliberately, so a stranger cannot confirm the
    // route exists. But the admin arriving from THIS email gets that same blank
    // 404 whenever their session is any account other than ADMIN_EMAIL, with
    // nothing to say which of the two things went wrong. That happened on the
    // first claim GTASearch ever received: ADMIN_EMAIL held one address and the
    // owner's actual account was registered under another, so the queue simply
    // looked broken. This email goes only to the admin, so naming the account
    // leaks nothing and turns a dead end into a self-diagnosing one.
    `${args.claimantName} (${args.role}) claimed "${args.businessName}", ${args.businessAddress}.\n\nAccount: ${args.claimantEmail}\n\nEvidence given:\n${args.evidence}\n\nReview it here:\n${process.env.NEXTAUTH_URL ?? ""}/admin/claims\n\nSign in as ${to}. The admin pages return a plain 404 for any other account — including your own, if it is registered under a different address than ADMIN_EMAIL.\n\nApproving hands the listing over and turns on its verified badge, so check the evidence against the business's own website first.`,
  );
}

/** Tells a claimant the outcome. A rejection carries the reviewer's note so
 *  they know what to fix — a silent "no" is what makes people give up. */
export async function sendClaimDecisionEmail(
  to: string,
  args: {
    businessName: string; approved: boolean; note: string;
    businessUrl: string; dashboardUrl: string;
  },
): Promise<boolean> {
  if (!emailEnabled()) return false;
  return deliver(
    to,
    args.approved
      ? `You now manage ${args.businessName} on GTASearch`
      : `About your claim for ${args.businessName}`,
    args.approved
      ? `Your claim for "${args.businessName}" was approved — the listing is yours to manage.\n\nYou can correct the details, add photos and hours, and your listing now shows a verified badge. All free.\n\nManage it:\n${args.dashboardUrl}\n\nView it:\n${args.businessUrl}\n${args.note ? `\nNote from our team: ${args.note}\n` : ""}`
      : `We could not approve your claim for "${args.businessName}" yet.\n\n${args.note ? `Reason: ${args.note}\n\n` : ""}You can claim again with more detail — anything checkable against public records helps, such as an email at the business's own domain, its website, or a business number.\n\nTry again:\n${args.businessUrl}/claim`,
  );
}

/** Tells an owner someone reviewed their business, so they can reply.
 *  Deliberately offers no way to remove it — owners answer criticism, they
 *  never erase it. */
export async function sendNewReviewEmail(
  to: string,
  args: { businessName: string; rating: number; snippet: string; businessUrl: string },
): Promise<boolean> {
  if (!emailEnabled()) return false;
  return deliver(
    to,
    `New ${args.rating}-star review for ${args.businessName}`,
    `Someone left a ${args.rating}-star review for "${args.businessName}":\n\n"${args.snippet}"\n\nYou can reply publicly here:\n${args.businessUrl}\n\nReplying openly to an honest review usually does more for you than the review costs you.`,
  );
}

export async function sendExpiryReminderEmail(
  to: string,
  args: { title: string; daysLeft: number; dashboardUrl: string },
): Promise<boolean> {
  if (!emailEnabled()) return false;
  return deliver(
    to,
    `Your ad "${args.title}" expires in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}`,
    `Your GTASearch ad "${args.title}" expires in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}.\n\nRelist it free in one click from your dashboard:\n${args.dashboardUrl}\n\nIf it sold — congratulations! Mark it sold from the same page.`,
  );
}
