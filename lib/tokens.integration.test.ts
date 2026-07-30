import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createResetToken, consumeResetToken } from "@/lib/tokens";

let userId: string;
const EMAIL = `vitest-tokens-${Date.now()}@example.com`;

beforeAll(async () => {
  const u = await db.user.create({ data: { email: EMAIL, name: "Token Test" } });
  userId = u.id;
});
afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  await db.$disconnect();
});

describe("reset tokens", () => {
  it("round-trips: create then consume returns the userId", async () => {
    const raw = await createResetToken(userId);
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    const stored = await db.passwordResetToken.findFirst({ where: { userId } });
    expect(stored!.tokenHash).not.toBe(raw); // only the hash is stored
    expect(await consumeResetToken(raw)).toBe(userId);
  });

  it("is single-use", async () => {
    const raw = await createResetToken(userId);
    expect(await consumeResetToken(raw)).toBe(userId);
    expect(await consumeResetToken(raw)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const raw = await createResetToken(userId);
    await db.passwordResetToken.updateMany({ where: { userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await consumeResetToken(raw)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await consumeResetToken("not-a-token")).toBeNull();
  });
});
