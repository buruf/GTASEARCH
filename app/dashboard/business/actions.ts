"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClaimError, ownedBusiness } from "@/lib/claims";
import { BusinessProfileSchema } from "@/lib/validation";
import { violatesModeration } from "@/lib/moderation";
import { photoLimitFor } from "@/lib/plans";

export interface OwnerState {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
}

/** Resolves the caller's ownership of the posted business, or an error. */
async function guard(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return { error: "Please sign in again." as const };
  const businessId = String(formData.get("businessId") ?? "");
  if (!businessId) return { error: "Missing business." as const };
  try {
    const business = await ownedBusiness(userId, businessId);
    return { userId, business };
  } catch (err) {
    // Deliberately the same message whether the business does not exist or
    // belongs to somebody else — otherwise this is an ownership oracle.
    if (err instanceof ClaimError) return { error: "Business not found." as const };
    throw err;
  }
}

export async function updateBusinessProfile(
  _prev: OwnerState | undefined,
  formData: FormData,
): Promise<OwnerState> {
  const g = await guard(formData);
  if ("error" in g) return { error: g.error };

  const parsed = BusinessProfileSchema.safeParse({
    description: formData.get("description"),
    phone: formData.get("phone") ?? "",
    website: formData.get("website") ?? "",
    hours: formData.get("hours") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  if (violatesModeration(parsed.data.description)) {
    return { error: "That description could not be saved. Please reword it." };
  }

  await db.business.update({
    where: { id: g.business.id },
    data: {
      description: parsed.data.description,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      hours: parsed.data.hours || null,
    },
  });

  revalidatePath(`/biz/${g.business.slug}`);
  revalidatePath("/dashboard/business");
  return { ok: "Saved. Your listing is updated." };
}

export async function updateBusinessPhotos(
  _prev: OwnerState | undefined,
  formData: FormData,
): Promise<OwnerState> {
  const g = await guard(formData);
  if ("error" in g) return { error: g.error };

  const urls = formData.getAll("photos").map(String).filter(Boolean);
  const limit = photoLimitFor(g.business.plan);
  if (urls.length > limit) {
    return {
      error: `Your plan allows up to ${limit} photos. Remove some, or upgrade to Pro for more.`,
    };
  }

  await db.business.update({
    where: { id: g.business.id },
    data: { images: urls },
  });

  revalidatePath(`/biz/${g.business.slug}`);
  revalidatePath("/dashboard/business");
  return { ok: "Photos updated." };
}
