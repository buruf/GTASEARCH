// Verification tokens, against the real database.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  createVerificationToken,
  consumeVerificationToken,
  isVerifiedUser,
} from "@/lib/email-verification";

const STAMP = Date.now().toString(36);
const EMAIL = `vitest-verify-${STAMP}@example.com`;
let userId = "";

beforeAll(async () => {
  const u = await db.user.create({ data: { email: EMAIL, name: "Vitest Verify" } });
  userId = u.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: `vitest-verify-${STAMP}` } } });
});

describe("email verification tokens", () => {
  it("confirms the account, exactly once", async () => {
    // Created just now, so it is on the far side of the grandfather date.
    expect(await isVerifiedUser(userId)).toBe(false);

    const raw = await createVerificationToken(userId);
    expect(await consumeVerificationToken(raw)).toBe(userId);
    expect(await isVerifiedUser(userId)).toBe(true);

    // Replay must not work: a link forwarded or sitting in a mail archive
    // cannot be used a second time.
    expect(await consumeVerificationToken(raw)).toBeNull();
  });

  it("refuses an unknown token", async () => {
    expect(await consumeVerificationToken("not-a-real-token")).toBeNull();
  });

  it("refuses an expired token", async () => {
    const raw = await createVerificationToken(userId);
    await db.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consumeVerificationToken(raw)).toBeNull();
  });

  // Otherwise an old link stays live after the account is already confirmed.
  it("retires every other outstanding link when one is used", async () => {
    const u = await db.user.create({
      data: { email: `vitest-verify-${STAMP}-b@example.com`, name: "Vitest Verify B" },
    });
    const first = await createVerificationToken(u.id);
    const second = await createVerificationToken(u.id);
    expect(await consumeVerificationToken(second)).toBe(u.id);
    expect(await consumeVerificationToken(first)).toBeNull();
  });

  // The raw value must never be recoverable from the table.
  it("stores only a hash", async () => {
    const raw = await createVerificationToken(userId);
    const hit = await db.emailVerificationToken.findFirst({ where: { tokenHash: raw } });
    expect(hit).toBeNull();
  });

  it("says no for a user that no longer exists", async () => {
    expect(await isVerifiedUser("cl00000000000000000000000")).toBe(false);
  });
});
