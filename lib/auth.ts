import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/users";
import { googleEnabled } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

// Precomputed bcrypt (cost 12) hash of an arbitrary fixed string, used only to
// pay the same bcrypt.compare cost for unknown-email / no-password-hash
// accounts as a real password check does. Without this, an unknown email
// returns instantly while a known email with a wrong password waits on a
// ~cost-12 bcrypt compare — an attacker can time responses to enumerate which
// emails have accounts. This hash never matches any real password; its only
// purpose is to burn the same wall-clock time.
export const DUMMY_HASH = "$2b$12$WF4VoD0QelE.xgzlJAYka.OlHZw2lDQ9Mcss.M13WpoDJhpzAoUtS";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  // Explicit, and identical to the expression in middleware.ts — see the
  // comment there. Both runtimes MUST derive the JWT key from the same value.
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  // JWT because the credentials provider cannot use database sessions.
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        // Per-email attempt cap, ahead of any DB lookup. Keyed by email (not
        // IP) because authorize() has no reliable IP here; 10 attempts per
        // 15 minutes is enough to blunt credential stuffing / brute force
        // without locking out a user who simply mistypes a password a few
        // times. Refusal returns the same generic null the UI already shows
        // for bad credentials, so it doesn't reveal that a limit exists.
        if (!rateLimit(`signin:${email}`, 10, 15 * 60 * 1000)) return null;

        const user = await db.user.findUnique({ where: { email } });
        // Same null (→ same generic error) for unknown email and wrong
        // password: sign-in must not confirm which emails have accounts.
        // Also pay the same bcrypt cost in both cases (see DUMMY_HASH above)
        // so the response time doesn't leak whether the email exists.
        if (!user?.passwordHash) {
          await verifyPassword(password, DUMMY_HASH);
          return null;
        }
        const ok = await verifyPassword(password, user.passwordHash);
        return ok ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
    // Keys-later: with no Google env vars, the provider (and its button) simply
    // does not exist. Spec §1/§8.
    ...(googleEnabled()
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

/** For server components/actions on protected routes: session or bounce. */
export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");
  return session.user.id;
}

/** For pages that render differently for signed-in vs. anonymous visitors
 *  without forcing sign-in (e.g. the listing detail page). */
export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
