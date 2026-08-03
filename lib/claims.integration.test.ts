// Integration tests for business claiming, against the real database.
//
// Self-provisioning like the other integration suites: everything created here
// is prefixed and torn down in afterAll. Covers the rules that only the
// database can prove — the one-pending-claim-per-user partial unique index,
// and the approval transaction that must never leave a business verified with
// no owner.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  ClaimError,
  approveClaim,
  claimFor,
  pendingClaimCount,
  pendingClaims,
  rejectClaim,
  submitClaim,
  businessesOwnedBy,
  ownedBusiness,
} from "@/lib/claims";

const STAMP = Date.now();
const PREFIX = `vitest-claim-${STAMP}-`;

let businessId = "";
let otherBusinessId = "";
let ownerId = "";
let rivalId = "";
let adminId = "";

const claimInput = {
  contactName: "Sam Owner",
  contactEmail: "sam@example.com",
  contactPhone: "416-555-0100",
  roleAtBusiness: "owner",
  evidence: "Our website is example.com and the phone on the listing is our shop line.",
};

beforeAll(async () => {
  const mkUser = async (tag: string) =>
    (
      await db.user.create({
        data: { email: `${PREFIX}${tag}@example.com`, name: `${tag} user` },
        select: { id: true },
      })
    ).id;
  ownerId = await mkUser("owner");
  rivalId = await mkUser("rival");
  adminId = await mkUser("admin");

  const mkBiz = async (tag: string) =>
    (
      await db.business.create({
        data: {
          slug: `${PREFIX}${tag}`,
          name: `${tag} business`,
          description: "Test fixture.",
          category: "health",
          city: "toronto",
          address: "1 Test St",
          images: [],
          status: "active",
          source: "open-data",
        },
        select: { id: true },
      })
    ).id;
  businessId = await mkBiz("main");
  otherBusinessId = await mkBiz("other");
});

afterAll(async () => {
  await db.businessClaim.deleteMany({ where: { business: { slug: { startsWith: PREFIX } } } });
  await db.business.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await db.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await db.$disconnect();
});

describe("submitClaim", () => {
  it("files a pending claim and finds it again", async () => {
    const id = await submitClaim(businessId, ownerId, claimInput);
    expect(id).toBeTruthy();
    const found = await claimFor(businessId, ownerId);
    expect(found?.status).toBe("pending");
  });

  it("folds a repeat submission into the existing pending claim", async () => {
    const before = await pendingClaimCount();
    const id = await submitClaim(businessId, ownerId, {
      ...claimInput,
      evidence: "Updated evidence: our business number is 123456789.",
    });
    const after = await pendingClaimCount();
    expect(after).toBe(before); // no second row in the review queue
    const rows = await db.businessClaim.findMany({
      where: { businessId, userId: ownerId },
      select: { id: true, evidence: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].evidence).toContain("123456789");
  });

  it("lets a different person file a competing claim", async () => {
    const id = await submitClaim(businessId, rivalId, claimInput);
    expect(id).toBeTruthy();
  });
});

describe("approveClaim", () => {
  it("hands over the business, verifies it, and moots competing claims", async () => {
    const claim = await db.businessClaim.findFirstOrThrow({
      where: { businessId, userId: ownerId, status: "pending" },
      select: { id: true },
    });
    await approveClaim(claim.id, adminId, "Checked against their website.");

    const business = await db.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { claimedById: true, verified: true },
    });
    expect(business.claimedById).toBe(ownerId);
    expect(business.verified).toBe(true);

    // The rival's claim must not still be sitting in the queue.
    const rival = await db.businessClaim.findFirstOrThrow({
      where: { businessId, userId: rivalId },
      select: { status: true, reviewNote: true },
    });
    expect(rival.status).toBe("rejected");
    expect(rival.reviewNote).toContain("approved");
  });

  it("refuses to review the same claim twice", async () => {
    const claim = await db.businessClaim.findFirstOrThrow({
      where: { businessId, userId: ownerId },
      select: { id: true },
    });
    await expect(approveClaim(claim.id, adminId, "")).rejects.toBeInstanceOf(ClaimError);
  });

  it("refuses a new claim on an already-claimed business", async () => {
    await expect(submitClaim(businessId, rivalId, claimInput)).rejects.toBeInstanceOf(ClaimError);
  });
});

describe("rejectClaim", () => {
  it("rejects a pending claim and leaves the business unclaimed", async () => {
    const id = await submitClaim(otherBusinessId, rivalId, claimInput);
    await rejectClaim(id, adminId, "Could not verify.");

    const claim = await db.businessClaim.findUniqueOrThrow({
      where: { id },
      select: { status: true, reviewNote: true },
    });
    expect(claim.status).toBe("rejected");
    expect(claim.reviewNote).toBe("Could not verify.");

    const business = await db.business.findUniqueOrThrow({
      where: { id: otherBusinessId },
      select: { claimedById: true, verified: true },
    });
    expect(business.claimedById).toBeNull();
    expect(business.verified).toBe(false);
  });

  it("lets a rejected claimant try again", async () => {
    // The unique index is partial on status='pending', which is what makes a
    // second attempt possible after a rejection.
    const id = await submitClaim(otherBusinessId, rivalId, {
      ...claimInput,
      evidence: "Second attempt with the business number this time: 987654321.",
    });
    expect(id).toBeTruthy();
    const pending = await db.businessClaim.count({
      where: { businessId: otherBusinessId, userId: rivalId, status: "pending" },
    });
    expect(pending).toBe(1);
  });

  it("refuses to reject an already-reviewed claim", async () => {
    const done = await db.businessClaim.findFirstOrThrow({
      where: { businessId: otherBusinessId, userId: rivalId, status: "rejected" },
      select: { id: true },
    });
    await expect(rejectClaim(done.id, adminId, "")).rejects.toBeInstanceOf(ClaimError);
  });
});

describe("owner access", () => {
  it("lists businesses the owner controls", async () => {
    const owned = await businessesOwnedBy(ownerId);
    expect(owned.map((b) => b.id)).toContain(businessId);
    expect(owned.every((b) => b.plan === "free")).toBe(true); // nothing is Pro by default
  });

  it("ownedBusiness refuses a business the user does not own", async () => {
    await expect(ownedBusiness(rivalId, businessId)).rejects.toBeInstanceOf(ClaimError);
    await expect(ownedBusiness(ownerId, businessId)).resolves.toMatchObject({ id: businessId });
  });
});

describe("the review queue", () => {
  it("returns oldest first so nobody waits forever", async () => {
    const rows = await pendingClaims();
    const mine = rows.filter((r) => r.business.slug.startsWith(PREFIX));
    for (let i = 1; i < mine.length; i++) {
      expect(mine[i].createdAt.getTime()).toBeGreaterThanOrEqual(mine[i - 1].createdAt.getTime());
    }
  });
});
