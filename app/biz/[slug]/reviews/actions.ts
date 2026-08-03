"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReviewError, deleteOwnReview, respondToReview, upsertReview } from "@/lib/reviews";
import { OwnerResponseSchema, ReviewSchema } from "@/lib/validation";
import { violatesModeration } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import { sendNewReviewEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";

export interface ReviewState {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
}

async function businessBySlug(slug: string) {
  return db.business.findUnique({ where: { slug }, select: { id: true, slug: true } });
}

export async function submitReviewAction(
  _prev: ReviewState | undefined,
  formData: FormData,
): Promise<ReviewState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Please sign in to write a review." };

  const slug = String(formData.get("slug") ?? "");
  // Rate limited per user, not per business: the abuse case is one account
  // spraying ratings across many listings.
  if (!rateLimit(`review:${userId}`, 10, 60 * 60 * 1000)) {
    return { error: "You have posted several reviews recently. Try again later." };
  }

  const parsed = ReviewSchema.safeParse({
    rating: formData.get("rating"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  if (violatesModeration(parsed.data.body)) {
    return { error: "That review could not be posted. Please reword it." };
  }

  const business = await db.business.findUnique({
    where: { slug },
    select: { id: true, name: true, claimedBy: { select: { email: true } } },
  });
  if (!business) return { error: "That business no longer exists." };

  let created = false;
  try {
    ({ created } = await upsertReview(business.id, userId, parsed.data.rating, parsed.data.body));
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    throw err;
  }

  // Only on a NEW review — editing your own wording should not re-notify the
  // owner every time. Awaited, and failure never fails the action.
  if (created && business.claimedBy?.email) {
    try {
      await sendNewReviewEmail(business.claimedBy.email, {
        businessName: business.name,
        rating: parsed.data.rating,
        snippet: parsed.data.body.slice(0, 200),
        businessUrl: `${appUrl()}/biz/${slug}`,
      });
    } catch {
      /* review stands regardless */
    }
  }

  revalidatePath(`/biz/${slug}`);
  return { ok: "Thanks — your review is live." };
}

export async function deleteReviewAction(
  _prev: ReviewState | undefined,
  formData: FormData,
): Promise<ReviewState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Please sign in again." };
  const slug = String(formData.get("slug") ?? "");
  const business = await businessBySlug(slug);
  if (!business) return { error: "That business no longer exists." };

  try {
    await deleteOwnReview(business.id, userId);
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/biz/${slug}`);
  return { ok: "Your review was removed." };
}

export async function respondToReviewAction(
  _prev: ReviewState | undefined,
  formData: FormData,
): Promise<ReviewState> {
  const userId = await currentUserId();
  if (!userId) return { error: "Please sign in again." };

  const parsed = OwnerResponseSchema.safeParse({ response: formData.get("response") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save that reply." };
  }
  if (violatesModeration(parsed.data.response)) {
    return { error: "That reply could not be posted. Please reword it." };
  }

  const reviewId = String(formData.get("reviewId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  try {
    await respondToReview(reviewId, userId, parsed.data.response);
  } catch (err) {
    if (err instanceof ReviewError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/biz/${slug}`);
  return { ok: "Your reply is posted." };
}
