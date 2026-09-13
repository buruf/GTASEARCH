import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { canonicalEmail } from "@/lib/email-identity";

const BCRYPT_COST = 12;

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Registers a user.
 *
 * `ok` is always true, whether or not the address was already taken — the
 * CALLER's response must not distinguish the two (anti-enumeration; the same
 * class of leak fixed in the eduyro audit). A duplicate simply creates
 * nothing.
 *
 * `userId` is present only when this call actually created the account. It
 * exists so the caller can send a confirmation link to a genuinely new
 * registration without mailing one to somebody who already has an account —
 * which would turn sign-up into a way to spam a stranger's inbox. It must
 * never leak into the response the browser sees.
 */
export async function createUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ ok: true; userId?: string }> {
  const passwordHash = await hashPassword(input.password);
  try {
    const created = await db.user.create({
      data: {
        // emailCanonical is deliberately absent: Postgres generates it from
        // this address, so writing it here would be rejected — and no caller,
        // including NextAuth's Google adapter, has to know it exists.
        email: input.email,
        name: `${input.firstName} ${input.lastName}`.trim(),
        passwordHash,
      },
      select: { id: true },
    });
    return { ok: true, userId: created.id };
  } catch (e: unknown) {
    // P2002 = unique violation, on `email` OR on the generated
    // `emailCanonical` — an alias of an inbox that already has an account
    // lands here and creates nothing. Swallowed deliberately: the response is
    // identical either way, so sign-up still never reveals which addresses
    // already have accounts.
    const code = (e as { code?: string }).code;
    if (code !== "P2002") throw e;
  }
  return { ok: true };
}
