import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  adminStats, openReportsByListing, dismissReports,
  removeListingWithReports, restoreListing, adminSearchListings,
} from "@/lib/admin";
import { getPublicListing } from "@/lib/listing";

const STAMP = Date.now();
const EMAILS = [`vitest-adm-seller-${STAMP}@example.com`, `vitest-adm-rep-${STAMP}@example.com`];
let sellerId: string, reporterId: string, listingId: string;

beforeAll(async () => {
  sellerId = (await db.user.create({ data: { email: EMAILS[0], name: "Adm Seller" } })).id;
  reporterId = (await db.user.create({ data: { email: EMAILS[1], name: "Adm Reporter" } })).id;
  listingId = (await db.listing.create({ data: {
    title: `Admin fixture zzq${STAMP}`, description: "Fixture listing for admin console tests, cleaned up after.",
    category: "electronics", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: sellerId,
  } })).id;
  await db.report.create({ data: { listingId, reporterId, reason: "scam" } });
  await db.report.create({ data: { listingId, reporterId: null, reason: "other", details: "anon detail" } });
});

afterAll(async () => {
  await db.report.deleteMany({ where: { listingId } });
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  await db.$disconnect();
});

describe("reports queue", () => {
  it("groups open reports under the listing with reporter names crossed in", async () => {
    const groups = await openReportsByListing();
    const g = groups.find((x) => x.listing.id === listingId)!;
    expect(g.reports).toHaveLength(2);
    expect(g.listing.seller.email).toBe(EMAILS[0]);
    const names = g.reports.map((r) => r.reporterName);
    expect(names).toContain("Adm Reporter");
    expect(names).toContain(null); // anonymous
  });

  it("dismiss closes all open reports and leaves the listing alone", async () => {
    expect(await dismissReports(listingId)).toBe(2);
    expect((await openReportsByListing()).find((x) => x.listing.id === listingId)).toBeUndefined();
    expect((await db.listing.findUnique({ where: { id: listingId } }))!.status).toBe("active");
    // Re-open for the next test.
    await db.report.updateMany({ where: { listingId }, data: { status: "open" } });
  });

  it("remove soft-deletes the listing, actions its reports, hides it publicly", async () => {
    expect(await removeListingWithReports(listingId)).toBe(2);
    expect((await db.listing.findUnique({ where: { id: listingId } }))!.status).toBe("deleted");
    expect(await db.report.count({ where: { listingId, status: "actioned" } })).toBe(2);
    expect(await getPublicListing(listingId)).toBeNull();
  });

  it("restore reactivates with a fresh ~30-day expiry and re-armed reminder", async () => {
    await restoreListing(listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.status).toBe("active");
    expect(row!.expiryReminderAt).toBeNull();
    const days = (row!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(await getPublicListing(listingId)).not.toBeNull();
  });
});

describe("search and stats", () => {
  it("finds by title fragment and by seller email, any status", async () => {
    await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
    const byTitle = await adminSearchListings(`zzq${STAMP}`);
    expect(byTitle.some((r) => r.id === listingId)).toBe(true);
    const byEmail = await adminSearchListings(EMAILS[0]);
    expect(byEmail.some((r) => r.id === listingId)).toBe(true);
    expect(byEmail.find((r) => r.id === listingId)!.seller.email).toBe(EMAILS[0]);
    await db.listing.update({ where: { id: listingId }, data: { status: "active" } });
  });

  it("stats counts move with fixtures", async () => {
    const s = await adminStats();
    expect(s.users).toBeGreaterThanOrEqual(2);
    expect(s.activeListings).toBeGreaterThanOrEqual(1);
    expect(typeof s.boostRevenue).toBe("number");
  });
});
