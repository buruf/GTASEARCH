import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createReport } from "@/lib/reports";

const STAMP = Date.now();
const EMAILS = [
  `vitest-rep-owner-${STAMP}@example.com`,
  `vitest-rep-user-${STAMP}@example.com`,
  `vitest-rep-racer-${STAMP}@example.com`,
];
let ownerId: string, reporterId: string, listingId: string;

beforeAll(async () => {
  ownerId = (await db.user.create({ data: { email: EMAILS[0], name: "Owner" } })).id;
  reporterId = (await db.user.create({ data: { email: EMAILS[1], name: "Reporter" } })).id;
  listingId = (await db.listing.create({ data: {
    title: "Reportable fixture", description: "A listing that exists to be reported by the test suite.",
    category: "electronics", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: ownerId,
  } })).id;
});

afterAll(async () => {
  await db.report.deleteMany({ where: { listingId } });
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  await db.$disconnect();
});

describe("createReport", () => {
  it("stores an anonymous report", async () => {
    const r = await createReport(null, listingId, "scam", "asked for e-transfer deposit");
    expect(r).toEqual({ ok: true, duplicate: false });
    const row = await db.report.findFirst({ where: { listingId, reporterId: null } });
    expect(row!.status).toBe("open");
  });

  it("dedupes signed-in reporters per listing", async () => {
    expect(await createReport(reporterId, listingId, "offensive", "")).toEqual({ ok: true, duplicate: false });
    expect(await createReport(reporterId, listingId, "scam", "second try")).toEqual({ ok: true, duplicate: true });
    expect(await db.report.count({ where: { listingId, reporterId } })).toBe(1);
  });

  it("anonymous reports are never deduped against each other", async () => {
    await createReport(null, listingId, "other", "");
    expect(await db.report.count({ where: { listingId, reporterId: null } })).toBe(2);
  });

  it("dedupe survives a race: concurrent duplicate inserts yield one row", async () => {
    // Fresh reporter with no prior row for (racer.id, listingId), so both
    // concurrent calls pass the app-level findFirst check and actually race
    // the insert — the partial unique index must make the loser a duplicate,
    // not a crash.
    const racer = await db.user.create({ data: { email: `vitest-rep-racer-${STAMP}@example.com`, name: "Racer" } });
    const results = await Promise.all([
      createReport(racer.id, listingId, "other", "race a"),
      createReport(racer.id, listingId, "other", "race b"),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await db.report.count({ where: { listingId, reporterId: racer.id } })).toBe(1);
  });
});
