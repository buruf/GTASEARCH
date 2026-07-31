import { NextResponse } from "next/server";
import { expireListings, downgradeLapsedBoosts, sweepStaleDrafts, sendExpiryReminders } from "@/lib/cron";

export const maxDuration = 60;

// Vercel Cron calls GET with Authorization: Bearer ${CRON_SECRET}.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: an unset secret disables the endpoint rather than opening it.
  if (!secret) return NextResponse.json({ error: "cron not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
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
