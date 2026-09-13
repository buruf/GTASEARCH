// Proving the mailbox belongs to whoever registered it.
//
// emailCanonical (a generated column) stops one inbox holding several
// accounts. It says nothing about whether the person typing an address can
// read it — anyone can enter someone else's, or one nobody reads at all. Of
// the 146 accounts the site had accumulated by 2026-09-13, not one had ever
// confirmed anything, because nothing had ever asked.
//
// The gate is deliberately narrow. Verification is required to SPEAK in
// public or to reach another person — publishing a listing, messaging a
// seller, claiming a business, writing a review. It is NOT required to sign
// in, to browse, or for a business owner to manage a listing they already
// hold: that owner was verified by a human reading their evidence, which is
// stronger proof than a clicked link, and re-gating them on email would be
// friction with no safety in return.

import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";

/** Long enough to survive a mail delay and a person getting to it tomorrow,
 *  short enough that a leaked link is not useful next month. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Accounts created before verification existed are exempt.
 *
 * On 2026-09-13 every remaining account was reviewed by hand during the prune
 * that removed 136 dormant registrations. The ten survivors are the owner's
 * own accounts, three people who posted real listings, and the owner of a
 * business whose claim was approved by a human reading their evidence.
 * Locking those out of their own site to prove a mailbox they have already
 * demonstrated would be friction without safety.
 *
 * This date is the line, not a rolling window: everyone who registers from
 * here on must verify, forever.
 */
export const VERIFICATION_REQUIRED_FROM = new Date("2026-09-13T00:00:00.000Z");

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Creates a verification token; returns the RAW value for the emailed link.
 *  Only its SHA-256 hash is stored, so reading this table cannot verify
 *  anybody — the same rule lib/tokens.ts follows for password resets. */
export async function createVerificationToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  await db.emailVerificationToken.create({
    data: { tokenHash: sha256(raw), userId, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return raw;
}

/**
 * Consumes a token exactly once and marks the account verified.
 *
 * Returns the userId on success, or null for unknown, expired and
 * already-used tokens alike — indistinguishably, so a guessed value learns
 * nothing about which tokens exist.
 *
 * The claim and the flag move together in one transaction: a crash between
 * them would otherwise burn the link while leaving the account unverified,
 * stranding somebody with no way back except a new email.
 */
export async function consumeVerificationToken(raw: string): Promise<string | null> {
  const tokenHash = sha256(raw);
  try {
    return await db.$transaction(async (tx) => {
      const { count } = await tx.emailVerificationToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (count === 0) return null;

      const row = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!row) return null;

      await tx.user.update({
        where: { id: row.userId },
        data: { emailVerified: new Date() },
      });
      // Any other outstanding link for this account is now pointless.
      await tx.emailVerificationToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return row.userId;
    });
  } catch {
    return null;
  }
}

/**
 * May this account post publicly or contact someone?
 *
 * Verified, or registered before the gate existed. Anything else waits.
 */
export function isVerified(user: {
  emailVerified: Date | null;
  createdAt: Date;
}): boolean {
  if (user.emailVerified) return true;
  return user.createdAt < VERIFICATION_REQUIRED_FROM;
}

/** The same question, for a caller that only holds an id. Returns false for a
 *  user that no longer exists, so a deleted account cannot act. */
export async function isVerifiedUser(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, createdAt: true },
  });
  return u ? isVerified(u) : false;
}

/** One message, used everywhere the gate refuses, so the wording never drifts
 *  between the places it can appear. */
export const VERIFY_REQUIRED_MESSAGE =
  "Please confirm your email address first — we sent you a link when you signed up. You can send a new one from your dashboard.";

/**
 * The gate, in the shape a server action returns.
 *
 * Returns null to proceed, or the refusal to hand straight back. Lives here
 * rather than in each action so the rule and its wording have one home: five
 * call sites that each re-implement "is this person allowed to speak" is five
 * chances for one of them to drift.
 *
 * Placed in the ACTION, never only in the page — the pages are convenience,
 * the actions are the gate. Same rule the admin console follows.
 */
export async function verificationGate(
  userId: string,
): Promise<{ ok: false; error: string } | null> {
  return (await isVerifiedUser(userId)) ? null : { ok: false, error: VERIFY_REQUIRED_MESSAGE };
}
