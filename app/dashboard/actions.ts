"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { markSold, softDeleteListing, relistListing, NotOwnerError } from "@/lib/manage";
import { ProfileSchema, ChangePasswordSchema } from "@/lib/validation";
import { verifyPassword, hashPassword } from "@/lib/users";
import { invalidateResetTokens } from "@/lib/tokens";
import type { FormState } from "@/app/auth/actions";

async function lifecycle(fn: (u: string, l: string) => Promise<void>, formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  try {
    await fn(userId, listingId);
  } catch (e) {
    if (!(e instanceof NotOwnerError)) throw e;
    // Silently no-op for non-owners: nothing to reveal.
  }
  revalidatePath("/dashboard");
}

export async function markSoldAction(formData: FormData) { await lifecycle(markSold, formData); }
export async function deleteAction(formData: FormData) { await lifecycle(softDeleteListing, formData); }
export async function relistAction(formData: FormData) { await lifecycle(relistListing, formData); }

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db.user.update({ where: { id: userId }, data: { name: parsed.data.name, phone: parsed.data.phone || null } });
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = ChangePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.passwordHash || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { ok: false, error: "Your current password is incorrect." };
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await invalidateResetTokens(userId);
  return { ok: true };
}
