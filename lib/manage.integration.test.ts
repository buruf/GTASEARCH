import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateDraft } from "@/lib/draft";
import { publishDraft, markSold, softDeleteListing, relistListing, NotOwnerError } from "@/lib/manage";
import { getPublicListing } from "@/lib/listing";

let userId: string;
const EMAIL = `vitest-publish-${Date.now()}@example.com`;

beforeAll(async () => {
  const u = await db.user.create({ data: { email: EMAIL, name: "Publish Test" } });
  userId = u.id;
});
afterAll(async () => {
  await db.listing.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

describe("publishDraft", () => {
  it("refuses an incomplete draft", async () => {
    await getOrCreateDraft(userId);
    const r = await publishDraft(userId);
    expect(r.ok).toBe(false);
  });

  it("refuses a draft that violates moderation", async () => {
    await db.listing.updateMany({ where: { userId, status: "draft" }, data: {
      title: "cheap cocaine here", description: "definitely long enough description text for the gate", category: "electronics", city: "toronto",
    }});
    const r = await publishDraft(userId);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toMatch(/cocaine/i); // generic — never echo the word
  });

  it("publishes a clean complete draft: active, 30-day expiry, publicly visible", async () => {
    await db.listing.updateMany({ where: { userId, status: "draft" }, data: {
      title: "Vitest test lamp", description: "A perfectly ordinary lamp used to test the publish pipeline.", category: "furniture-home", city: "toronto",
    }});
    const r = await publishDraft(userId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const pub = await getPublicListing(r.listingId);
    expect(pub).not.toBeNull();
    expect(pub!.title).toBe("Vitest test lamp");
    const row = await db.listing.findUnique({ where: { id: r.listingId } });
    expect(row!.status).toBe("active");
    const days = (row!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});

describe("listing lifecycle mutations", () => {
  let otherUserId: string;
  let listingId: string;
  const EMAIL2 = `vitest-other-${Date.now()}@example.com`;

  beforeAll(async () => {
    const other = await db.user.create({ data: { email: EMAIL2, name: "Other" } });
    otherUserId = other.id;
    const l = await db.listing.create({ data: {
      title: "Lifecycle lamp", description: "A lamp for testing ownership and lifecycle transitions.",
      category: "furniture-home", city: "toronto", images: [], status: "active",
      expiresAt: new Date(Date.now() + 30 * 86_400_000), userId,
    }});
    listingId = l.id;
  });
  afterAll(async () => { await db.user.deleteMany({ where: { email: EMAIL2 } }); });

  it("a non-owner cannot mutate (IDOR guard)", async () => {
    await expect(markSold(otherUserId, listingId)).rejects.toThrow(NotOwnerError);
    await expect(softDeleteListing(otherUserId, listingId)).rejects.toThrow(NotOwnerError);
    await expect(relistListing(otherUserId, listingId)).rejects.toThrow(NotOwnerError);
  });

  it("mark sold → relist resets a 30-day expiry and reactivates", async () => {
    await markSold(userId, listingId);
    expect((await db.listing.findUnique({ where: { id: listingId } }))!.status).toBe("sold");
    await relistListing(userId, listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.status).toBe("active");
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it("delete is soft — row remains, status deleted, invisible publicly", async () => {
    await softDeleteListing(userId, listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.status).toBe("deleted");
    const { getPublicListing } = await import("@/lib/listing");
    expect(await getPublicListing(listingId)).toBeNull();
  });

  it("a draft cannot be published through markSold/relist (moderation bypass guard)", async () => {
    const draft = await getOrCreateDraft(userId);
    await expect(markSold(userId, draft.id)).rejects.toThrow(NotOwnerError);
    await expect(relistListing(userId, draft.id)).rejects.toThrow(NotOwnerError);
    const row = await db.listing.findUnique({ where: { id: draft.id } });
    expect(row!.status).toBe("draft");
    await db.listing.delete({ where: { id: draft.id } });
  });

  it("relist clears the expiry reminder marker", async () => {
    await db.listing.update({
      where: { id: listingId },
      data: { status: "sold", expiryReminderAt: new Date() },
    });
    await relistListing(userId, listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.expiryReminderAt).toBeNull();
  });

  it("relist works on a cron-expired listing (the 'Relist for free' CTA from the reminder email)", async () => {
    await db.listing.update({
      where: { id: listingId },
      data: {
        status: "expired",
        expiresAt: new Date(Date.now() - 2 * 86_400_000),
        expiryReminderAt: new Date(),
      },
    });
    await relistListing(userId, listingId);
    const row = await db.listing.findUnique({ where: { id: listingId } });
    expect(row!.status).toBe("active");
    const days = (row!.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    expect(row!.expiryReminderAt).toBeNull();
  });
});
