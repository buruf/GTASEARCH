import { withAuth } from "next-auth/middleware";

// Protects authenticated areas; anonymous users bounce to sign-in with a
// callbackUrl back to where they were headed.
export default withAuth({ pages: { signIn: "/auth/signin" } });

export const config = {
  matcher: ["/post-ad/:path*", "/post-ad", "/dashboard/:path*", "/dashboard", "/listing/:id/edit", "/listing/:id/boost", "/messages/:path*", "/messages", "/saved"],
};
