"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RegisterSchema } from "@/lib/validation";
import { createUser, hashPassword, verifyPassword } from "@/lib/users";
import { createVerificationToken } from "@/lib/email-verification";
import { currentUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { canonicalEmail, isDisposableEmail, looksAutomated } from "@/lib/email-identity";
import { db } from "@/lib/db";
import { DUMMY_HASH } from "@/lib/auth";
import { createResetToken, consumeResetToken, invalidateResetTokens } from "@/lib/tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { emailEnabled, appUrl } from "@/lib/env";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function clientIp(): string {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/**
 * Sign-up, with the guards added on 2026-09-12.
 *
 * Between Sep 4 and Sep 12 the site took 131 registrations and produced one
 * empty draft listing, no messages and no reviews. The accounts were
 * dot-permutations of real business inboxes — the Gmail alias trick — arriving
 * at 12-23 a day. Nothing had been posted yet; what existed was a stock of
 * accounts waiting to post.
 *
 * Every check below either costs a real person nothing or fails in their
 * favour. None of them answers a bot differently from a human: an attacker who
 * learns WHICH guard stopped them tunes around it in an afternoon, so every
 * automated refusal returns the same generic message.
 */
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const REFUSED: FormState = {
    ok: false,
    error: "We couldn't complete that sign-up. Please try again.",
  };

  if (!rateLimit(`register:${clientIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many attempts. Please try again later." };
  }

  // A hidden field a person never sees, plus how long the form was on screen.
  // Both are supplied BY the form, so neither can be trusted on its own; they
  // are cheap filters for unsophisticated bots. The guarantee is the unique
  // index on emailCanonical, which no client input can talk its way past.
  const stamp = formData.get("renderedAt");
  const elapsedMs =
    typeof stamp === "string" && /^\d{1,15}$/.test(stamp) ? Date.now() - Number(stamp) : null;
  if (looksAutomated(formData.get("website") as string | null, elapsedMs)) {
    return REFUSED;
  }

  const parsed = RegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors };
  }

  // An inbox that expires cannot still own a business listing next month.
  if (isDisposableEmail(parsed.data.email)) {
    return { ok: false, fieldErrors: { email: "Please use a permanent email address." } };
  }

  // A second cap, keyed on the MAILBOX rather than the address. The per-IP cap
  // above never fired during the September run — spread across a day it stayed
  // under five an hour, and the limiter is in-memory per serverless instance,
  // so any one instance sees only a fraction of the traffic.
  if (!rateLimit(`register-inbox:${canonicalEmail(parsed.data.email)}`, 3, 24 * 60 * 60 * 1000)) {
    return REFUSED;
  }

  const created = await createUser(parsed.data);

  // Send the confirmation link only when this call actually made an account.
  // createUser reports that without revealing it to the caller's response, so
  // a duplicate sign-up still returns the identical { ok: true } below and
  // cannot be used to discover which addresses are registered — while also not
  // mailing "confirm your account" to somebody who already has one, which is
  // how an enumeration oracle turns into a harassment tool.
  if (created.userId && emailEnabled()) {
    const raw = await createVerificationToken(created.userId);
    await sendVerificationEmail(parsed.data.email, `${appUrl()}/auth/verify/${raw}`);
  }

  // Identical response whether the email was new, already taken, or an alias of
  // an inbox that already has an account (anti-enumeration).
  return { ok: true };
}

/**
 * Sends a fresh confirmation link to the signed-in account.
 *
 * Rate limited per user, because this is a button that makes us send mail: a
 * loop on it would turn the site into somebody else's spam relay and burn the
 * sending domain's reputation, which is far harder to undo than a bounce.
 */
export async function resendVerificationAction(): Promise<FormState> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Sign in first." };
  if (!emailEnabled()) {
    return { ok: false, error: "Email isn't configured yet. Please contact support." };
  }
  if (!rateLimit(`verify-resend:${userId}`, 3, 60 * 60 * 1000)) {
    return { ok: false, error: "We've sent that a few times already. Try again in an hour." };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (!user) return { ok: false, error: "Sign in first." };
  // Already done: say so rather than sending a link that confirms nothing.
  if (user.emailVerified) return { ok: true };

  const raw = await createVerificationToken(userId);
  await sendVerificationEmail(user.email, `${appUrl()}/auth/verify/${raw}`);
  return { ok: true };
}

export async function forgotAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!emailEnabled()) {
    return { ok: false, error: "Password reset email isn't configured yet. Please contact support." };
  }
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: "Enter a valid email address." };
  if (!rateLimit(`forgot:${email.data}`, 3, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many reset requests. Please try again later." };
  }

  const user = await db.user.findUnique({ where: { email: email.data } });
  if (user) {
    const raw = await createResetToken(user.id);
    await sendPasswordResetEmail(user.email, `${appUrl()}/auth/reset/${raw}`);
  } else {
    // Dummy work so the response time does not reveal whether the account
    // exists. See comment on DUMMY_HASH in lib/auth.ts.
    await verifyPassword("timing-equalization", DUMMY_HASH);
  }
  // Identical response whether or not the account exists.
  return { ok: true };
}

const ResetSchema = z
  .object({ token: z.string().min(1), password: z.string().min(8).max(100), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export async function resetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const userId = await consumeResetToken(parsed.data.token);
  if (!userId) return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };

  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await invalidateResetTokens(userId);
  redirect("/auth/signin?reset=1");
}
