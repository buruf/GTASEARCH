import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { expireListings, downgradeLapsedBoosts, sweepStaleDrafts, sendExpiryReminders } from "@/lib/cron";

export const maxDuration = 60;

/** Constant-time comparison — same posture as the rest of the codebase's
 *  secret checks; a plain !== leaks match-length through response timing. */
function bearerMatches(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Vercel Cron calls GET with Authorization: Bearer ${CRON_SECRET}.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: an unset secret disables the endpoint rather than opening it.
  if (!secret) return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Each job isolated: one failure must not stop the rest.
  const safe = (p: Promise<number>) => p.catch((e) => { console.error("cron job failed:", e); return -1; });
  const [expired, downgraded, draftsSwept, remindersSent] = [
    await safe(expireListings()),
    await safe(downgradeLapsedBoosts()),
    await safe(sweepStaleDrafts()),
    await safe(sendExpiryReminders()),
  ];
  return NextResponse.json({ expired, downgraded, draftsSwept, remindersSent });
}
