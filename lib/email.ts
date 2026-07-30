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
