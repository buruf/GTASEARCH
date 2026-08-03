// Business claiming (Phase 5B).
//
// An owner asks to take control of a directory listing; an admin reviews it by
// hand and approves or rejects. Approval is what sets Business.claimedById and
// Business.verified — nothing else in the codebase may set `verified`, because
// the badge means "a human checked that this person runs this business" and it
// is worthless the moment anything else can turn it on.
//
// Why manual review: proving ownership automatically needs a channel we can
// send a secret to — an email to the address on the business's own domain, or
// an SMS to its published number. Neither an email nor an SMS provider is
// configured for this project, so the honest options were manual review or no
// claiming at all. The evidence field exists to give the reviewer something
// concrete to check against the public record.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export class ClaimError extends Error {}

export interface ClaimInput {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  roleAtBusiness: string;
  evidence: string;
}

/** The claim this user already has on this business, if any. */
export async function claimFor(businessId: string, userId: string) {
  return db.businessClaim.findFirst({
    where: { businessId, userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, createdAt: true, reviewNote: true },
  });
}

/**
 * Files a claim. Returns the claim id.
 *
 * Refuses when the business is already claimed by someone — a second owner
 * would silently overwrite the first on approval — and folds a repeat
 * submission into the caller's existing pending claim rather than filling the
 * review queue with duplicates. The partial unique index
 * (BusinessClaim_one_pending_per_user) enforces the same rule in the database,
 * so a race between two tabs cannot get past it either.
 */
export async function submitClaim(
  businessId: string,
  userId: string,
  input: ClaimInput,
): Promise<string> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, claimedById: true, status: true },
  });
  if (!business || business.status !== "active") {
    throw new ClaimError("That business is not available to claim.");
  }
  if (business.claimedById) {
    throw new ClaimError(
      business.claimedById === userId
        ? "You already manage this business."
        : "This business has already been claimed. Contact us if that is wrong.",
    );
  }

  const data = {
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone || null,
    roleAtBusiness: input.roleAtBusiness,
    evidence: input.evidence,
  };

  const existingPending = await db.businessClaim.findFirst({
    where: { businessId, userId, status: "pending" },
    select: { id: true },
  });
  if (existingPending) {
    await db.businessClaim.update({ where: { id: existingPending.id }, data });
    return existingPending.id;
  }

  try {
    const created = await db.businessClaim.create({
      data: { businessId, userId, status: "pending", ...data },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    // Lost the race against another tab; the winner's row is the claim.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await db.businessClaim.findFirst({
        where: { businessId, userId, status: "pending" },
        select: { id: true },
      });
      if (winner) return winner.id;
    }
    throw err;
  }
}

export interface PendingClaimRow {
  id: string;
  createdAt: Date;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  roleAtBusiness: string;
  evidence: string;
  business: { id: string; slug: string; name: string; address: string; city: string; website: string | null; phone: string | null };
  user: { id: string; email: string; name: string };
}

export async function pendingClaims(): Promise<PendingClaimRow[]> {
  return db.businessClaim.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" }, // oldest first — nobody waits forever
    select: {
      id: true,
      createdAt: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      roleAtBusiness: true,
      evidence: true,
      business: {
        select: { id: true, slug: true, name: true, address: true, city: true, website: true, phone: true },
      },
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function pendingClaimCount(): Promise<number> {
  return db.businessClaim.count({ where: { status: "pending" } });
}

/**
 * Approves a claim: marks it approved, hands the business to the claimant and
 * turns on the verified badge — atomically, so a crash can never leave a
 * business verified with no owner or an approved claim that granted nothing.
 *
 * Re-checks that the business is still unclaimed inside the transaction: two
 * admins approving competing claims in different tabs would otherwise have the
 * second silently steal the business from the first.
 */
export async function approveClaim(claimId: string, reviewerId: string, note: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const claim = await tx.businessClaim.findUnique({
      where: { id: claimId },
      select: { id: true, status: true, businessId: true, userId: true },
    });
    if (!claim) throw new ClaimError("Claim not found.");
    if (claim.status !== "pending") throw new ClaimError("That claim has already been reviewed.");

    const business = await tx.business.findUnique({
      where: { id: claim.businessId },
      select: { claimedById: true },
    });
    if (!business) throw new ClaimError("Business no longer exists.");
    if (business.claimedById && business.claimedById !== claim.userId) {
      throw new ClaimError("That business was claimed by someone else while this was open.");
    }

    await tx.businessClaim.update({
      where: { id: claimId },
      data: { status: "approved", reviewedAt: new Date(), reviewedById: reviewerId, reviewNote: note || null },
    });
    await tx.business.update({
      where: { id: claim.businessId },
      data: { claimedById: claim.userId, verified: true },
    });
    // Any other pending claim on this business is now moot.
    await tx.businessClaim.updateMany({
      where: { businessId: claim.businessId, status: "pending", id: { not: claimId } },
      data: {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedById: reviewerId,
        reviewNote: "Another claim on this business was approved.",
      },
    });
  });
}

export async function rejectClaim(claimId: string, reviewerId: string, note: string): Promise<void> {
  const updated = await db.businessClaim.updateMany({
    where: { id: claimId, status: "pending" },
    data: { status: "rejected", reviewedAt: new Date(), reviewedById: reviewerId, reviewNote: note || null },
  });
  if (updated.count === 0) throw new ClaimError("That claim has already been reviewed.");
}

/** Businesses this user owns, for their dashboard. */
export async function businessesOwnedBy(userId: string) {
  return db.business.findMany({
    where: { claimedById: userId },
    orderBy: { name: "asc" },
    select: {
      id: true, slug: true, name: true, category: true, city: true,
      address: true, phone: true, website: true, plan: true, planRenewsAt: true,
      images: true, verified: true,
    },
  });
}

/** Throws unless this user owns this business — every owner action re-guards. */
export async function ownedBusiness(userId: string, businessId: string) {
  const business = await db.business.findFirst({
    where: { id: businessId, claimedById: userId },
    select: {
      id: true, slug: true, name: true, description: true, phone: true,
      website: true, hours: true, images: true, plan: true, planRenewsAt: true,
      stripeCustomerId: true,
    },
  });
  if (!business) throw new ClaimError("Business not found.");
  return business;
}
