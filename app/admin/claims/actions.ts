"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { ClaimError, approveClaim, rejectClaim } from "@/lib/claims";

export interface ReviewState {
  error?: string;
  ok?: string;
}

/** Both actions re-check admin themselves — the layout is not a guard. */
async function review(
  formData: FormData,
  run: (claimId: string, adminId: string, note: string) => Promise<void>,
  done: string,
): Promise<ReviewState> {
  const adminId = await requireAdmin();
  const claimId = String(formData.get("claimId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  if (!claimId) return { error: "Missing claim." };

  try {
    await run(claimId, adminId, note);
  } catch (err) {
    if (err instanceof ClaimError) return { error: err.message };
    throw err;
  }

  revalidatePath("/admin/claims");
  revalidatePath("/admin");
  return { ok: done };
}

export async function approveClaimAction(
  _prev: ReviewState | undefined,
  formData: FormData,
): Promise<ReviewState> {
  return review(formData, approveClaim, "Claim approved — the owner now manages that listing.");
}

export async function rejectClaimAction(
  _prev: ReviewState | undefined,
  formData: FormData,
): Promise<ReviewState> {
  return review(formData, rejectClaim, "Claim rejected.");
}
