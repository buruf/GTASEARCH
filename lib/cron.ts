// The four nightly jobs (spec §6). Pure of HTTP: the route wraps these with
// bearer auth. Each returns a count for the cron's JSON report.

import { db } from "@/lib/db";
import { sendExpiryReminderEmail } from "@/lib/email";
import { appUrl, resendEnabled } from "@/lib/env";

const DAY = 86_400_000;
const REMINDER_WINDOW_DAYS = 3;
const REMINDER_CAP = 50; // Resend free tier is 100/day; leave headroom.

export async function expireListings(now: Date = new Date()): Promise<number> {
  const r = await db.listing.updateMany({
    where: { status: "active", expiresAt: { lt: now } },
    data: { status: "expired" },
  });
  return r.count;
}

export async function downgradeLapsedBoosts(now: Date = new Date()): Promise<number> {
  // Bookkeeping only: search already ignores lapsed boosts via the
  // effective-boost rule, so nothing is wrongly promoted before this runs.
  const r = await db.listing.updateMany({
    where: { boostLevel: { not: "none" }, boostExpiresAt: { lt: now } },
    data: { boostLevel: "none", boostExpiresAt: null },
  });
  return r.count;
}

export async function sweepStaleDrafts(now: Date = new Date()): Promise<number> {
  // Global version of the per-user sweep in lib/draft.ts (kept as
  // belt-and-braces).
  const r = await db.listing.deleteMany({
    where: { status: "draft", createdAt: { lt: new Date(now.getTime() - 7 * DAY) } },
  });
  return r.count;
}

type ReminderSender = (
  to: string,
  args: { title: string; daysLeft: number; dashboardUrl: string },
) => Promise<boolean>;

export async function sendExpiryReminders(
  send: ReminderSender = sendExpiryReminderEmail,
  now: Date = new Date(),
): Promise<number> {
  // Degraded mode: leave everything unmarked so reminders flow the day the
  // email key arrives. (Injected senders in tests bypass this gate.)
  if (send === sendExpiryReminderEmail && !resendEnabled()) return 0;

  const due = await db.listing.findMany({
    where: {
      status: "active",
      expiryReminderAt: null,
      expiresAt: { gt: now, lt: new Date(now.getTime() + REMINDER_WINDOW_DAYS * DAY) },
    },
    select: {
      id: true, title: true, expiresAt: true,
      user: { select: { email: true } },
    },
    orderBy: { expiresAt: "asc" },
    take: REMINDER_CAP,
  });

  let sent = 0;
  for (const l of due) {
    const daysLeft = Math.max(1, Math.ceil((l.expiresAt.getTime() - now.getTime()) / DAY));
    const ok = await send(l.user.email, {
      title: l.title, daysLeft, dashboardUrl: `${appUrl()}/dashboard`,
    }).catch(() => false);
    if (ok) {
      // Mark only successes; failures retry on the next run.
      await db.listing.update({ where: { id: l.id }, data: { expiryReminderAt: now } });
      sent++;
    }
  }
  return sent;
}
