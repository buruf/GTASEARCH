// Reviews (Phase 5C).
//
// THE RULE THIS FILE EXISTS TO ENFORCE: GTASearch never invents social proof.
// Every review is written by a signed-in account through the review form.
// There is no seeding path, no import path and no admin "add review" — the
// only writes are the ones below, and each carries a userId that came from a
// session. A directory that manufactures its own ratings is worthless, and
// the damage cannot be undone once it is in.
//
// The denormalised Business.reviewCount/ratingSum are updated in the SAME
// transaction as every review write, so a crash can never leave a business
// showing an average that its reviews do not support. The database also
// enforces that (Business_review_aggregates_sane, added in the migration).

import { db } from "@/lib/db";

export class ReviewError extends Error {}

/** Rounded to one decimal, or null when nobody has reviewed yet. */
export function averageRating(ratingSum: number, reviewCount: number): number | null {
  if (reviewCount <= 0) return null;
  return Math.round((ratingSum / reviewCount) * 10) / 10;
}

export interface ReviewRow {
  id: string;
  rating: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  ownerResponse: string | null;
  ownerRespondedAt: Date | null;
  user: { id: string; name: string };
}

export async function reviewsFor(businessId: string, take = 50): Promise<ReviewRow[]> {
  return db.review.findMany({
    where: { businessId, status: "published" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, rating: true, body: true, createdAt: true, updatedAt: true,
      ownerResponse: true, ownerRespondedAt: true,
      user: { select: { id: true, name: true } },
    },
  });
}

export async function myReview(businessId: string, userId: string) {
  return db.review.findUnique({
    where: { businessId_userId: { businessId, userId } },
    select: { id: true, rating: true, body: true, status: true },
  });
}

/**
 * Creates or updates the caller's review, keeping the business aggregates in
 * step atomically.
 *
 * Refuses a review of your own business. Self-reviewing is the single most
 * corrosive thing that can happen to a directory's ratings, and the owner of a
 * claimed listing is the one person we can actually identify — so we check.
 */
export async function upsertReview(
  businessId: string,
  userId: string,
  rating: number,
  body: string,
): Promise<{ created: boolean }> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewError("Pick a rating from 1 to 5.");
  }

  return db.$transaction(async (tx) => {
    const business = await tx.business.findUnique({
      where: { id: businessId },
      select: { id: true, status: true, claimedById: true },
    });
    if (!business || business.status !== "active") {
      throw new ReviewError("That business is not available to review.");
    }
    if (business.claimedById === userId) {
      throw new ReviewError("You cannot review a business you manage.");
    }

    const existing = await tx.review.findUnique({
      where: { businessId_userId: { businessId, userId } },
      select: { id: true, rating: true, status: true },
    });

    if (existing) {
      await tx.review.update({
        where: { id: existing.id },
        data: { rating, body },
      });
      // Only shift the sum by the delta; a hidden review contributes nothing
      // to the aggregates, so leave them alone in that case.
      if (existing.status === "published") {
        await tx.business.update({
          where: { id: businessId },
          data: { ratingSum: { increment: rating - existing.rating } },
        });
      }
      return { created: false };
    }

    await tx.review.create({
      data: { businessId, userId, rating, body },
    });
    await tx.business.update({
      where: { id: businessId },
      data: { reviewCount: { increment: 1 }, ratingSum: { increment: rating } },
    });
    return { created: true };
  });
}

/** Deletes the caller's own review. Owners cannot delete reviews about them. */
export async function deleteOwnReview(businessId: string, userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const existing = await tx.review.findUnique({
      where: { businessId_userId: { businessId, userId } },
      select: { id: true, rating: true, status: true },
    });
    if (!existing) throw new ReviewError("You have not reviewed this business.");

    await tx.review.delete({ where: { id: existing.id } });
    if (existing.status === "published") {
      await tx.business.update({
        where: { id: businessId },
        data: { reviewCount: { decrement: 1 }, ratingSum: { decrement: existing.rating } },
      });
    }
  });
}

/**
 * The owner's public reply. Deliberately the ONLY thing an owner can do to a
 * review — they may answer criticism but never edit, hide or remove it.
 */
export async function respondToReview(
  reviewId: string,
  ownerId: string,
  response: string,
): Promise<void> {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { id: true, business: { select: { claimedById: true } } },
  });
  if (!review || review.business.claimedById !== ownerId) {
    throw new ReviewError("Review not found.");
  }
  await db.review.update({
    where: { id: reviewId },
    data: {
      ownerResponse: response.trim() || null,
      ownerRespondedAt: response.trim() ? new Date() : null,
    },
  });
}

/**
 * Moderation. Hiding a review removes it from the public page and from the
 * aggregates; restoring puts both back. Admin-only, and used for abuse — not
 * for unflattering opinions.
 */
export async function setReviewStatus(reviewId: string, status: "published" | "hidden"): Promise<void> {
  await db.$transaction(async (tx) => {
    const review = await tx.review.findUnique({
      where: { id: reviewId },
      select: { id: true, rating: true, status: true, businessId: true },
    });
    if (!review) throw new ReviewError("Review not found.");
    if (review.status === status) return;

    await tx.review.update({ where: { id: reviewId }, data: { status } });
    const delta = status === "published" ? 1 : -1;
    await tx.business.update({
      where: { id: review.businessId },
      data: {
        reviewCount: { increment: delta },
        ratingSum: { increment: delta * review.rating },
      },
    });
  });
}

/**
 * Recomputes aggregates from the reviews themselves. Not used in the request
 * path — it exists so a drift caused by a future bug can be repaired without
 * hand-written SQL, and so tests can assert the denormalised values match.
 */
export async function recomputeAggregates(businessId: string): Promise<{ reviewCount: number; ratingSum: number }> {
  const agg = await db.review.aggregate({
    where: { businessId, status: "published" },
    _count: { _all: true },
    _sum: { rating: true },
  });
  const reviewCount = agg._count._all;
  const ratingSum = agg._sum.rating ?? 0;
  await db.business.update({ where: { id: businessId }, data: { reviewCount, ratingSum } });
  return { reviewCount, ratingSum };
}
