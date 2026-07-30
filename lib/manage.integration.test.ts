import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getOrCreateDraft } from "@/lib/draft";
import { publishDraft } from "@/lib/manage";
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
