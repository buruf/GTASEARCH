import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { adminEmail } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Why the admin console is or is not letting you in.
 *
 * requireAdmin() answers with a bare 404 and nothing else, deliberately: an
 * admin route must not confirm it exists. The cost is that the real admin,
 * locked out, cannot tell which of three things is wrong — signed in as the
 * wrong account, ADMIN_EMAIL not set in this environment, or set to a
 * different address. Each has a different fix, and guessing between them from
 * a blank 404 took several attempts on the first claim GTASearch received.
 *
 * This reports only what the caller already knows or could already see:
 *   - their own session email, which is theirs;
 *   - whether they are the admin, which the user menu already shows them;
 *   - whether an admin address is configured at all — a boolean, never the
 *     value, so this can never be used to discover who the admin is.
 *
 * Signed-out callers get the same 404 the admin pages give, so this adds no
 * new surface for anyone without an account.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = session.user.email ?? null;
  const configured = adminEmail() !== null;
  const isAdmin = isAdminEmail(email);

  return NextResponse.json({
    signedInAs: email,
    adminEmailConfigured: configured,
    isAdmin,
    diagnosis: isAdmin
      ? "You are the admin. /admin will load."
      : !email
        ? "Your session carries no email address, so the admin check can never match. Sign out and sign in again."
        : !configured
          ? "ADMIN_EMAIL is not set in this environment. Set it in Vercel (Production) and redeploy — env changes do not apply to existing deployments."
          : "ADMIN_EMAIL is set, but it is not this address. Either sign in as the account it names, or change it in Vercel to the address above and redeploy.",
  });
}
