"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { ReviewError, setReviewStatus } from "@/lib/reviews";

export interface ModerateState {
  error?: string;
  ok?: string;
}

export async function moderateReviewAction(
  _prev: ModerateState | undefined,
  formData: FormData,
): Promise<ModerateState> {
  await requireAdmin(); // re-guards; the layout is not a guard
  const reviewId = String(formData.get("reviewId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "published" && status !== "hidden") return { error: "Unknown action." };

  try {
    await setReviewStatus(reviewId, status);
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    throw err;
  }

  // The business page shows the review and its rating, so both must refresh.
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { business: { select: { slug: true } } },
  });
  if (review) revalidatePath(`/biz/${review.business.slug}`);
  revalidatePath("/admin/reviews");
  return { ok: status === "hidden" ? "Review hidden." : "Review restored." };
}
