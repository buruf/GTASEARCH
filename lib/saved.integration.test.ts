import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { toggleSaved, savedIdsFor, savedListingsFor } from "@/lib/saved";

const STAMP = Date.now();
const EMAILS = [`vitest-sav-owner-${STAMP}@example.com`, `vitest-sav-fan-${STAMP}@example.com`];
let ownerId: string, fanId: string, listingId: string;

beforeAll(async () => {
  ownerId = (await db.user.create({ data: { email: EMAILS[0], name: "Owner" } })).id;
  fanId = (await db.user.create({ data: { email: EMAILS[1], name: "Fan" } })).id;
  listingId = (await db.listing.create({ data: {
    title: "Saveable fixture chair", description: "A chair whose only purpose is to be saved by tests.",
    category: "furniture-home", city: "toronto", images: [], status: "active",
    expiresAt: new Date(Date.now() + 30 * 86_400_000), userId: ownerId,
  } })).id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: EMAILS } } });
  await db.$disconnect();
});

describe("favourites", () => {
  it("toggles on, then off, idempotently", async () => {
    expect((await toggleSaved(fanId, listingId)).saved).toBe(true);
    expect(await savedIdsFor(fanId, [listingId])).toEqual([listingId]);
    expect((await toggleSaved(fanId, listingId)).saved).toBe(false);
    expect(await savedIdsFor(fanId, [listingId])).toEqual([]);
  });

  it("saved page rows carry honest display status", async () => {
    await toggleSaved(fanId, listingId);
    await db.listing.update({ where: { id: listingId }, data: { status: "sold" } });
    const rows = await savedListingsFor(fanId);
    const row = rows.find((r) => r.id === listingId)!;
    expect(row.displayStatus).toBe("sold");
    await db.listing.update({ where: { id: listingId }, data: { status: "active" } });
  });

  it("savedIdsFor only reports ids from the requested set", async () => {
    expect(await savedIdsFor(fanId, ["nonexistent-id"])).toEqual([]);
  });
});
