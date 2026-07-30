"use server";

import { headers } from "next/headers";
import { RegisterSchema } from "@/lib/validation";
import { createUser } from "@/lib/users";
import { rateLimit } from "@/lib/rate-limit";

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
