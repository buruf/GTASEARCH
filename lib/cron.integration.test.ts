import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { expireListings, downgradeLapsedBoosts, sweepStaleDrafts, sendExpiryReminders } from "@/lib/cron";

const STAMP = Date.now();
const EMAIL = `vitest-cron-${STAMP}@example.com`;
// Second user for the draft-sweep test only: the DB enforces one draft per
// user (partial unique index "Listing_one_draft_per_user"), so two drafts
// alive at once for the selectivity assertion must belong to different users.
const EMAIL2 = `vitest-cron-2-${STAMP}@example.com`;
let userId: string;
let userId2: string;
const DAY = 86_400_000;

const mk = (over: Record<string, unknown>) => db.listing.create({ data: {
  title: `Cron fixture ${Math.random().toString(36).slice(2, 8)}`,
  description: "Fixture for nightly cron behaviour tests, cleaned up afterwards.",
  category: "electronics", city: "toronto", images: [], status: "active",
  expiresAt: new Date(Date.now() + 30 * DAY), userId, ...over,
} });

beforeAll(async () => {
  userId = (await db.user.create({ data: { email: EMAIL, name: "Cron Test" } })).id;
  userId2 = (await db.user.create({ data: { email: EMAIL2, name: "Cron Test 2" } })).id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: [EMAIL, EMAIL2] } } });
  await db.$disconnect();
});

describe("nightly cron jobs", () => {
  it("expireListings flips only active listings past expiry", async () => {
    const past = await mk({ expiresAt: new Date(Date.now() - DAY) });
    const future = await mk({});
    const sold = await mk({ status: "sold", expiresAt: new Date(Date.now() - DAY) });
    const n = await expireListings();
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await db.listing.findUnique({ where: { id: past.id } }))!.status).toBe("expired");
    expect((await db.listing.findUnique({ where: { id: future.id } }))!.status).toBe("active");
    expect((await db.listing.findUnique({ where: { id: sold.id } }))!.status).toBe("sold");
  });

  it("downgradeLapsedBoosts clears only lapsed boosts", async () => {
    const lapsed = await mk({ boostLevel: "featured", boostExpiresAt: new Date(Date.now() - DAY) });
    const live = await mk({ boostLevel: "super", boostExpiresAt: new Date(Date.now() + DAY) });
    await downgradeLapsedBoosts();
    const l = await db.listing.findUnique({ where: { id: lapsed.id } });
    expect(l!.boostLevel).toBe("none");
    expect(l!.boostExpiresAt).toBeNull();
    expect((await db.listing.findUnique({ where: { id: live.id } }))!.boostLevel).toBe("super");
  });

  it("sweepStaleDrafts deletes only old drafts", async () => {
    const oldDraft = await mk({ status: "draft", createdAt: new Date(Date.now() - 8 * DAY) });
    const freshDraft = await mk({ status: "draft", userId: userId2 });
    await sweepStaleDrafts();
    expect(await db.listing.findUnique({ where: { id: oldDraft.id } })).toBeNull();
    expect(await db.listing.findUnique({ where: { id: freshDraft.id } })).not.toBeNull();
  }, 20_000);

  it("sendExpiryReminders emails once per cycle via the injected sender, marking only successes", async () => {
    const due = await mk({ expiresAt: new Date(Date.now() + 2 * DAY) });
    const notDue = await mk({ expiresAt: new Date(Date.now() + 10 * DAY) });
    const sent: string[] = [];
    const okSender = async (_to: string, args: { title: string }) => { sent.push(args.title); return true; };

    const n1 = await sendExpiryReminders(okSender);
    expect(n1).toBeGreaterThanOrEqual(1);
    const dueRow = await db.listing.findUnique({ where: { id: due.id } });
    expect(dueRow!.expiryReminderAt).not.toBeNull();
    expect((await db.listing.findUnique({ where: { id: notDue.id } }))!.expiryReminderAt).toBeNull();

    // Second run: already marked — nothing new for this listing.
    const before = sent.length;
    await sendExpiryReminders(okSender);
    expect(sent.length).toBe(before);

    // Failed sends stay unmarked so the next run retries.
    const due2 = await mk({ expiresAt: new Date(Date.now() + 2 * DAY) });
    const failSender = async () => false;
    await sendExpiryReminders(failSender);
    expect((await db.listing.findUnique({ where: { id: due2.id } }))!.expiryReminderAt).toBeNull();
  });
});
