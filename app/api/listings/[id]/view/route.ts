import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "gts_viewed";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

/**
 * Increments a listing's view count.
 *
 * Deduplicated by a cookie listing the IDs already counted, so a refresh loop
 * cannot inflate the number. The client also guards with sessionStorage; this
 * is the server-side backstop.
 *
 * Owner-view exclusion requires an authenticated session and lands in Phase 2 —
 * it is a single check added here once auth exists.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  const jar = cookies();
  const seen = (jar.get(COOKIE)?.value ?? "").split(",").filter(Boolean);

  if (seen.includes(id)) {
    return NextResponse.json({ counted: false });
  }

  try {
    await db.listing.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  } catch {
    // Unknown or deleted listing — nothing to count, and this endpoint must
    // never be a source of errors for the page.
    return NextResponse.json({ counted: false }, { status: 200 });
  }

  // Keep the cookie bounded; oldest entries fall off.
  const next = [...seen, id].slice(-40).join(",");
  const response = NextResponse.json({ counted: true });
  response.cookies.set(COOKIE, next, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
