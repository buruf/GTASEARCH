"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClaimError, submitClaim } from "@/lib/claims";
import { CLAIM_ROLES, ClaimSchema } from "@/lib/validation";
import { adminEmail } from "@/lib/env";
import { sendClaimSubmittedEmail } from "@/lib/email";
import { violatesModeration } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";

export interface ClaimState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function submitClaimAction(
  _prev: ClaimState | undefined,
  formData: FormData,
): Promise<ClaimState> {
  const userId = await currentUserId();
  const slug = String(formData.get("slug") ?? "");
  if (!userId) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/biz/${slug}/claim`)}`);
  }

  // Claims are reviewed by a human, so the cost of spam is somebody's time.
  if (!rateLimit(`claim:${userId}`, 5, 60 * 60 * 1000)) {
    return { error: "You have submitted several claims recently. Try again later." };
  }

  const parsed = ClaimSchema.safeParse({
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone") ?? "",
    roleAtBusiness: formData.get("roleAtBusiness"),
    evidence: formData.get("evidence"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  if (violatesModeration(parsed.data.evidence) || violatesModeration(parsed.data.contactName)) {
    return { error: "That could not be submitted. Please reword and try again." };
  }

  const business = await db.business.findUnique({
    where: { slug },
    select: { id: true, name: true, address: true },
  });
  if (!business) return { error: "That business no longer exists." };

  try {
    await submitClaim(business.id, userId, parsed.data);
  } catch (err) {
    if (err instanceof ClaimError) return { error: err.message };
    throw err;
  }

  // Awaited, not fire-and-forget: a serverless function can be frozen the
  // moment it returns, which silently drops a void-IIFE send (the Phase 3A
  // lesson). Failure is swallowed — the claim is already saved, and the
  // email is a convenience, not the record.
  const admin = adminEmail();
  if (admin) {
    try {
      await sendClaimSubmittedEmail(admin, {
        businessName: business.name,
        businessAddress: business.address,
        claimantName: parsed.data.contactName,
        claimantEmail: parsed.data.contactEmail,
        role: CLAIM_ROLES[parsed.data.roleAtBusiness] ?? parsed.data.roleAtBusiness,
        evidence: parsed.data.evidence,
      });
    } catch {
      /* claim stands regardless */
    }
  }

  revalidatePath(`/biz/${slug}`);
  redirect(`/biz/${slug}/claim?submitted=1`);
}
