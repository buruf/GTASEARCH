import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Creates a reset token; returns the RAW token for the email link. Only the
 *  SHA-256 hash is persisted, so a database leak cannot forge reset links. */
export async function createResetToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: { tokenHash: sha256(raw), userId, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return raw;
}

/** Consumes a raw token exactly once. Returns the userId, or null for
 *  unknown / expired / already-used tokens (indistinguishably). */
export async function consumeResetToken(raw: string): Promise<string | null> {
  const { count } = await db.passwordResetToken.updateMany({
    where: { tokenHash: sha256(raw), usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count === 0) return null;
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(raw) } });
  return row?.userId ?? null;
}

/** Invalidate all outstanding tokens (on successful reset / password change). */
export async function invalidateResetTokens(userId: string): Promise<void> {
  await db.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}
