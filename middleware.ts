import { withAuth } from "next-auth/middleware";

// Protects authenticated areas; anonymous users bounce to sign-in with a
// callbackUrl back to where they were headed.
//
// The secret is passed EXPLICITLY and must stay in lockstep with
// lib/auth.ts. NextAuth v4's route handlers and its edge middleware resolve
// env fallbacks differently (AUTH_SECRET vs NEXTAUTH_SECRET), which produced
// a production-only failure where login succeeded but every protected page
// bounced: the node runtime encoded sessions with a secret the edge
// middleware never found. Pinning both sides to one expression makes that
// divergence impossible.
export default withAuth({
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  pages: { signIn: "/auth/signin" },
});

export const config = {
  matcher: ["/post-ad/:path*", "/post-ad", "/dashboard/:path*", "/dashboard", "/listing/:id/edit", "/listing/:id/boost", "/messages/:path*", "/messages", "/saved"],
};
