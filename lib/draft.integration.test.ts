import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getDraft, getOrCreateDraft, discardDraft } from "@/lib/draft";
import { searchListings, parseSearchParams } from "@/lib/search";

let userId: string;
const EMAIL = `vitest-draft-${Date.now()}@example.com`;

beforeAll(async () => {
  const u = await db.user.create({ data: { email: EMAIL, name: "Draft Test" } });
  userId = u.id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } }); // cascades to draft
  await db.$disconnect();
});

describe("draft lifecycle", () => {
  it("getOrCreateDraft is idempotent — one draft per user", async () => {
    const a = await getOrCreateDraft(userId);
    const b = await getOrCreateDraft(userId);
    expect(b.id).toBe(a.id);
    expect(a.status).toBe("draft");
  });

  it("drafts are invisible to public search even with matching text", async () => {
    await db.listing.updateMany({
      where: { userId, status: "draft" },
      data: { title: "zzduniquedrafttitle sofa", description: "a draft that must never surface in public search results", city: "toronto", category: "furniture-home" },
    });
    const { rows, total } = await searchListings(parseSearchParams({ q: "zzduniquedrafttitle" }));
    expect(total).toBe(0);
    expect(rows).toHaveLength(0);
  });

  it("discardDraft removes it", async () => {
    await discardDraft(userId);
    expect(await getDraft(userId)).toBeNull();
  });

  it("stale drafts are swept on access", async () => {
    const d = await getOrCreateDraft(userId);
    await db.listing.update({ where: { id: d.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } });
    expect(await getDraft(userId)).toBeNull();
  });

  it("concurrent getOrCreateDraft calls both resolve to the same single draft", async () => {
    await discardDraft(userId);
    const [a, b] = await Promise.all([getOrCreateDraft(userId), getOrCreateDraft(userId)]);
    expect(a.id).toBe(b.id);
    const count = await db.listing.count({ where: { userId, status: "draft" } });
    expect(count).toBe(1);
  });
});
