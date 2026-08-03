"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { ClaimError, approveClaim, rejectClaim } from "@/lib/claims";
import { sendClaimDecisionEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";

export interface ReviewState {
  error?: string;
  ok?: string;
}

/** Both actions re-check admin themselves — the layout is not a guard. */
async function review(
  formData: FormData,
  run: (claimId: string, adminId: string, note: string) => Promise<void>,
  approved: boolean,
  done: string,
): Promise<ReviewState> {
  const adminId = await requireAdmin();
  const claimId = String(formData.get("claimId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!claimId) return { error: "Missing claim." };

  // Read the claim BEFORE deciding — approving auto-rejects competing claims,
  // and we want this claimant's own contact details, not whatever the row
  // looks like afterwards.
  const claim = await db.businessClaim.findUnique({
    where: { id: claimId },
    select: { contactEmail: true, business: { select: { slug: true, name: true } } },
  });

  try {
    await run(claimId, adminId, note);
  } catch (err) {
    if (err instanceof ClaimError) return { error: err.message };
    throw err;
  }

  // Awaited, never fire-and-forget: a serverless function can freeze the
  // instant it returns. The decision is already committed, so a failed send
  // must not fail the action.
  if (claim) {
    try {
      await sendClaimDecisionEmail(claim.contactEmail, {
        businessName: claim.business.name,
        approved,
        note,
        businessUrl: `${appUrl()}/biz/${claim.business.slug}`,
        dashboardUrl: `${appUrl()}/dashboard/business`,
      });
    } catch {
      /* decision stands regardless */
    }
    revalidatePath(`/biz/${claim.business.slug}`);
  }

  revalidatePath("/admin/claims");
  revalidatePath("/admin");
  return { ok: done };
}

export async function approveClaimAction(
  _prev: ReviewState | undefined,
  formData: FormData,
): Promise<ReviewState> {
  return review(
    formData,
    approveClaim,
    true,
    "Claim approved — the owner now manages that listing.",
  );
}

export async function rejectClaimAction(
  _prev: ReviewState | undefined,
  formData: FormData,
): Promise<ReviewState> {
  return review(formData, rejectClaim, false, "Claim rejected.");
}
