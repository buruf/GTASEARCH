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
  if (!resendEnabled()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "GTASearch <onboarding@resend.dev>",
      to,
      subject: `Claim submitted: ${args.businessName}`,
      text: `${args.claimantName} (${args.role}) claimed "${args.businessName}", ${args.businessAddress}.\n\nAccount: ${args.claimantEmail}\n\nEvidence given:\n${args.evidence}\n\nReview it here:\n${process.env.NEXTAUTH_URL ?? ""}/admin/claims\n\nApproving hands the listing over and turns on its verified badge, so check the evidence against the business's own website first.`,
    });
    return true;
  } catch {
    return false;
  }
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
  if (!resendEnabled()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "GTASearch <onboarding@resend.dev>",
      to,
      subject: args.approved
        ? `You now manage ${args.businessName} on GTASearch`
        : `About your claim for ${args.businessName}`,
      text: args.approved
        ? `Your claim for "${args.businessName}" was approved — the listing is yours to manage.\n\nYou can correct the details, add photos and hours, and your listing now shows a verified badge. All free.\n\nManage it:\n${args.dashboardUrl}\n\nView it:\n${args.businessUrl}\n${args.note ? `\nNote from our team: ${args.note}\n` : ""}`
        : `We could not approve your claim for "${args.businessName}" yet.\n\n${args.note ? `Reason: ${args.note}\n\n` : ""}You can claim again with more detail — anything checkable against public records helps, such as an email at the business's own domain, its website, or a business number.\n\nTry again:\n${args.businessUrl}/claim`,
    });
    return true;
  } catch {
    return false;
  }
}

/** Tells an owner someone reviewed their business, so they can reply.
 *  Deliberately offers no way to remove it — owners answer criticism, they
 *  never erase it. */
export async function sendNewReviewEmail(
  to: string,
  args: { businessName: string; rating: number; snippet: string; businessUrl: string },
): Promise<boolean> {
  if (!resendEnabled()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "GTASearch <onboarding@resend.dev>",
      to,
      subject: `New ${args.rating}-star review for ${args.businessName}`,
      text: `Someone left a ${args.rating}-star review for "${args.businessName}":\n\n"${args.snippet}"\n\nYou can reply publicly here:\n${args.businessUrl}\n\nReplying openly to an honest review usually does more for you than the review costs you.`,
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendExpiryReminderEmail(
  to: string,
  args: { title: string; daysLeft: number; dashboardUrl: string },
): Promise<boolean> {
  if (!resendEnabled()) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "GTASearch <onboarding@resend.dev>",
      to,
      subject: `Your ad "${args.title}" expires in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}`,
      text: `Your GTASearch ad "${args.title}" expires in ${args.daysLeft} day${args.daysLeft === 1 ? "" : "s"}.\n\nRelist it free in one click from your dashboard:\n${args.dashboardUrl}\n\nIf it sold — congratulations! Mark it sold from the same page.`,
    });
    return true;
  } catch {
    return false;
  }
}
