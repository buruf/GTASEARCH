import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Hand-rolled instead of next-auth's withAuth, for one hard-learned reason:
// withAuth decides which session-cookie NAME to read from whether
// NEXTAUTH_URL starts with "https://". A malformed value in the deployment
// env (it happened: pasted with surrounding text) silently flips that to the
// insecure cookie name, and every signed-in user bounces off protected pages
// while login itself works. Deriving secureCookie from the ACTUAL request
// protocol makes middleware immune to env formatting.
export async function middleware(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  const secureCookie =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https";

  const token = await getToken({ req, secret, secureCookie });
  if (token) return NextResponse.next();

  const signin = new URL("/auth/signin", req.url);
  signin.searchParams.set(
    "callbackUrl",
    req.nextUrl.pathname + req.nextUrl.search,
  );
  return NextResponse.redirect(signin);
}

export const config = {
  matcher: ["/post-ad/:path*", "/post-ad", "/dashboard/:path*", "/dashboard", "/listing/:id/edit", "/listing/:id/boost", "/messages/:path*", "/messages", "/saved"],
};
