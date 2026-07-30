import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const BCRYPT_COST = 12;

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Registers a user. Returns { ok: true } whether or not the email was already
 * taken — the caller must not be able to distinguish (anti-enumeration; the
 * same class of leak fixed in the eduyro audit). The duplicate attempt simply
 * creates nothing.
 */
export async function createUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<{ ok: true }> {
  const passwordHash = await hashPassword(input.password);
  try {
    await db.user.create({
      data: {
        email: input.email,
        name: `${input.firstName} ${input.lastName}`.trim(),
        passwordHash,
      },
    });
  } catch (e: unknown) {
    // P2002 = unique violation on email. Swallow deliberately.
    const code = (e as { code?: string }).code;
    if (code !== "P2002") throw e;
  }
  return { ok: true };
}
