// Integration tests for reviews, against the real database.
//
// The important assertions here are the integrity ones: the denormalised
// aggregates on Business must always match the reviews that produced them, an
// owner must never be able to review or silence their own listing, and the
// database itself must reject an out-of-range rating even if the application
// layer were bypassed.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  ReviewError,
  averageRating,
  deleteOwnReview,
  myReview,
  recomputeAggregates,
  respondToReview,
  reviewsFor,
  setReviewStatus,
  upsertReview,
} from "@/lib/reviews";

const STAMP = Date.now();
const PREFIX = `vitest-rev-${STAMP}-`;

let businessId = "";
let ownerId = "";
let alice = "";
let bob = "";

const aggregates = async () =>
  db.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { reviewCount: true, ratingSum: true },
  });

beforeAll(async () => {
  const mkUser = async (tag: string) =>
    (
      await db.user.create({
        data: { email: `${PREFIX}${tag}@example.com`, name: `${tag}` },
        select: { id: true },
      })
    ).id;
  ownerId = await mkUser("owner");
  alice = await mkUser("alice");
  bob = await mkUser("bob");

  businessId = (
    await db.business.create({
      data: {
        slug: `${PREFIX}biz`,
        name: "Review fixture",
        description: "Test fixture.",
        category: "health",
        city: "toronto",
        address: "1 Test St",
        images: [],
        status: "active",
        source: "open-data",
        claimedById: ownerId,
      },
      select: { id: true },
    })
  ).id;
});

afterAll(async () => {
  await db.review.deleteMany({ where: { business: { slug: { startsWith: PREFIX } } } });
  await db.business.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await db.$disconnect();
});

describe("averageRating", () => {
  it("is null with no reviews and rounds to one decimal", () => {
    expect(averageRating(0, 0)).toBeNull();
    expect(averageRating(9, 2)).toBe(4.5);
    expect(averageRating(10, 3)).toBe(3.3);
  });
});

describe("upsertReview", () => {
  it("creates a review and moves the aggregates in step", async () => {
    await upsertReview(businessId, alice, 5, "Excellent service, would go back.");
    expect(await aggregates()).toEqual({ reviewCount: 1, ratingSum: 5 });
  });

  it("edits in place instead of stacking a second review", async () => {
    await upsertReview(businessId, alice, 3, "On reflection it was fine, not amazing.");
    expect(await aggregates()).toEqual({ reviewCount: 1, ratingSum: 3 });
    const rows = await db.review.findMany({ where: { businessId, userId: alice } });
    expect(rows).toHaveLength(1);
  });

  it("accumulates across different people", async () => {
    await upsertReview(businessId, bob, 4, "Solid, friendly staff and fair pricing.");
    expect(await aggregates()).toEqual({ reviewCount: 2, ratingSum: 7 });
    expect(averageRating(7, 2)).toBe(3.5);
  });

  it("refuses to let an owner review their own business", async () => {
    await expect(
      upsertReview(businessId, ownerId, 5, "Best place in town, I should know."),
    ).rejects.toBeInstanceOf(ReviewError);
    expect(await aggregates()).toEqual({ reviewCount: 2, ratingSum: 7 });
  });

  it("rejects out-of-range ratings", async () => {
    await expect(upsertReview(businessId, bob, 0, "x".repeat(30))).rejects.toBeInstanceOf(ReviewError);
    await expect(upsertReview(businessId, bob, 6, "x".repeat(30))).rejects.toBeInstanceOf(ReviewError);
  });

  it("is rejected by the DATABASE too, not just the application", async () => {
    // The CHECK constraint is the last line of defence for a value that feeds
    // a public average.
    await expect(
      db.review.create({
        data: { businessId, userId: ownerId, rating: 9, body: "bypassing the app layer" },
      }),
    ).rejects.toThrow();
  });
});

describe("owner replies", () => {
  it("lets the owner reply but never edit the review itself", async () => {
    const review = await db.review.findFirstOrThrow({
      where: { businessId, userId: alice },
      select: { id: true, body: true },
    });
    await respondToReview(review.id, ownerId, "Sorry we missed the mark — please ask for Sam next time.");
    const after = await db.review.findUniqueOrThrow({
      where: { id: review.id },
      select: { body: true, ownerResponse: true, ownerRespondedAt: true },
    });
    expect(after.ownerResponse).toContain("Sorry we missed the mark");
    expect(after.ownerRespondedAt).not.toBeNull();
    expect(after.body).toBe(review.body); // untouched
  });

  it("refuses a reply from someone who does not own the business", async () => {
    const review = await db.review.findFirstOrThrow({
      where: { businessId, userId: alice },
      select: { id: true },
    });
    await expect(respondToReview(review.id, bob, "let me speak for them")).rejects.toBeInstanceOf(
      ReviewError,
    );
  });
});

describe("moderation", () => {
  it("hiding a review removes it from the page and the aggregates", async () => {
    const review = await db.review.findFirstOrThrow({
      where: { businessId, userId: bob },
      select: { id: true, rating: true },
    });
    await setReviewStatus(review.id, "hidden");
    expect(await aggregates()).toEqual({ reviewCount: 1, ratingSum: 3 });
    const visible = await reviewsFor(businessId);
    expect(visible.map((r) => r.id)).not.toContain(review.id);
  });

  it("restoring puts both back", async () => {
    const review = await db.review.findFirstOrThrow({
      where: { businessId, userId: bob },
      select: { id: true },
    });
    await setReviewStatus(review.id, "published");
    expect(await aggregates()).toEqual({ reviewCount: 2, ratingSum: 7 });
  });
});

describe("deleting your own review", () => {
  it("removes it and corrects the aggregates", async () => {
    await deleteOwnReview(businessId, bob);
    expect(await aggregates()).toEqual({ reviewCount: 1, ratingSum: 3 });
    expect(await myReview(businessId, bob)).toBeNull();
  });

  it("refuses when there is nothing to delete", async () => {
    await expect(deleteOwnReview(businessId, bob)).rejects.toBeInstanceOf(ReviewError);
  });
});

describe("aggregate integrity", () => {
  it("the denormalised counters match a recount from the reviews themselves", async () => {
    const before = await aggregates();
    const recomputed = await recomputeAggregates(businessId);
    expect(recomputed).toEqual(before);
  });
});
