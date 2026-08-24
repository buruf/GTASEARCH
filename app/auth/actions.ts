"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RegisterSchema } from "@/lib/validation";
import { createUser, hashPassword, verifyPassword } from "@/lib/users";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { DUMMY_HASH } from "@/lib/auth";
import { createResetToken, consumeResetToken, invalidateResetTokens } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { emailEnabled, appUrl } from "@/lib/env";

export type FormState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

function clientIp(): string {
  const h = headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(`register:${clientIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: "Too many attempts. Please try again later." };
  }

  const parsed = RegisterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { ok: false, fieldErrors };
  }

  await createUser(parsed.data);
  // Identical response whether the email was new or taken (anti-enumeration).
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
