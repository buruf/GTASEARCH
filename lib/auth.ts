import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/users";
import { googleEnabled } from "@/lib/env";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
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
        const user = await db.user.findUnique({ where: { email } });
        // Same null (→ same generic error) for unknown email and wrong
        // password: sign-in must not confirm which emails have accounts.
        if (!user?.passwordHash) return null;
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

export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
