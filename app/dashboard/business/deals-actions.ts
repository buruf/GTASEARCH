"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { DealError, createDeal, endDeal } from "@/lib/deals";
import { DealSchema } from "@/lib/validation";
import { violatesModeration } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";

export interface DealState {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
}

/** Both actions re-check ownership inside lib/deals — this is not the guard. */
async function requireUser(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) throw new DealError("Sign in first.");
  return userId;
}

export async function createDealAction(
  _prev: DealState | undefined,
  formData: FormData,
): Promise<DealState> {
  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return { error: "Sign in first." };
  }

  const businessId = String(formData.get("businessId") ?? "");
  if (!businessId) return { error: "Missing business." };

  if (!rateLimit(`deal:${userId}`, 10, 60 * 60 * 1000)) {
    return { error: "You have created several deals recently. Try again later." };
  }

  const parsed = DealSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    code: formData.get("code") ?? "",
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  // Owner-written text goes on a public page, so it passes the same filter as
  // reviews and messages.
  if (
    violatesModeration(parsed.data.title) ||
    violatesModeration(parsed.data.description) ||
    violatesModeration(parsed.data.code)
  ) {
    return { error: "That could not be published. Please reword and try again." };
  }

  // End of the chosen DAY, not midnight at its start — otherwise a deal
  // marked "ends 30 September" would stop showing on the 29th.
  const endsAt = new Date(`${parsed.data.endsAt}T23:59:59`);

  try {
    await createDeal(userId, businessId, { ...parsed.data, endsAt });
  } catch (err) {
    if (err instanceof DealError) return { error: err.message };
    throw err;
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { slug: true },
  });
  if (business) revalidatePath(`/biz/${business.slug}`);
  revalidatePath(`/dashboard/business/${businessId}`);
  revalidatePath("/deals");
  return { ok: "Deal published." };
}

export async function endDealAction(
  _prev: DealState | undefined,
  formData: FormData,
): Promise<DealState> {
  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return { error: "Sign in first." };
  }

  const dealId = String(formData.get("dealId") ?? "");
  const businessId = String(formData.get("businessId") ?? "");
  if (!dealId) return { error: "Missing deal." };

  try {
    await endDeal(userId, dealId);
  } catch (err) {
    if (err instanceof DealError) return { error: err.message };
    throw err;
  }

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { slug: true },
  });
  if (business) revalidatePath(`/biz/${business.slug}`);
  revalidatePath(`/dashboard/business/${businessId}`);
  revalidatePath("/deals");
  return { ok: "Deal ended." };
}
