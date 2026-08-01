// Admin console core. One admin, env-driven: the session email must match
// ADMIN_EMAIL. requireAdmin() 404s everyone else (never a 403 — admin routes
// must be unconfirmable), and every server action re-checks it: the pages are
// convenience, the actions are the gate.

import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminEmail } from "@/lib/env";
import { db } from "@/lib/db";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = adminEmail();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin.trim().toLowerCase();
}

export async function requireAdmin(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !isAdminEmail(session.user.email)) notFound();
  return session.user.id;
}

export async function adminStats() {
  const now = new Date();
  const [users, activeListings, drafts, sold, expired, openReports, revenue, unreadMessages] =
    await Promise.all([
      db.user.count(),
      db.listing.count({ where: { status: "active", expiresAt: { gt: now } } }),
      db.listing.count({ where: { status: "draft" } }),
      db.listing.count({ where: { status: "sold" } }),
      db.listing.count({
        where: { OR: [{ status: "expired" }, { status: "active", expiresAt: { lte: now } }] },
      }),
      db.report.count({ where: { status: "open" } }),
      db.boostPayment.aggregate({ _sum: { amount: true }, where: { status: "paid" } }),
      db.message.count({ where: { readAt: null } }),
    ]);
  return {
    users, activeListings, drafts, sold, expired, openReports,
    boostRevenue: Number(revenue._sum.amount ?? 0),
    unreadMessages,
  };
}

export interface QueueGroup {
  listing: {
    id: string; title: string; status: string; images: string[]; city: string;
    seller: { name: string; email: string };
  };
  reports: {
    id: string; reason: string; details: string | null;
    reporterName: string | null; createdAt: Date;
  }[];
}

export async function openReportsByListing(): Promise<QueueGroup[]> {
  const rows = await db.report.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, reason: true, details: true, createdAt: true,
      reporter: { select: { name: true } },
      listing: {
        select: {
          id: true, title: true, status: true, images: true, city: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const groups = new Map<string, QueueGroup>();
  for (const r of rows) {
    let g = groups.get(r.listing.id);
    if (!g) {
      g = {
        listing: {
          id: r.listing.id, title: r.listing.title, status: r.listing.status,
          images: r.listing.images, city: r.listing.city,
          seller: { name: r.listing.user.name, email: r.listing.user.email },
        },
        reports: [],
      };
      groups.set(r.listing.id, g);
    }
    g.reports.push({
      id: r.id, reason: r.reason, details: r.details,
      reporterName: r.reporter?.name ?? null, createdAt: r.createdAt,
    });
  }
  // Most-reported first; rows are newest-first so each group's first report
  // is its newest — stable tiebreak on that.
  return [...groups.values()].sort(
    (a, b) => b.reports.length - a.reports.length ||
      b.reports[0].createdAt.getTime() - a.reports[0].createdAt.getTime(),
  );
}

export async function dismissReports(listingId: string): Promise<number> {
  const r = await db.report.updateMany({
    where: { listingId, status: "open" },
    data: { status: "dismissed" },
  });
  return r.count;
}

export async function removeListingWithReports(listingId: string): Promise<number> {
  const [, reports] = await db.$transaction([
    db.listing.updateMany({ where: { id: listingId }, data: { status: "deleted" } }),
    db.report.updateMany({ where: { listingId, status: "open" }, data: { status: "actioned" } }),
  ]);
  return reports.count;
}

export async function restoreListing(listingId: string): Promise<void> {
  // Same cycle reset as a seller relist: fresh 30 days, reminder re-armed.
  await db.listing.updateMany({
    where: { id: listingId, status: "deleted" },
    data: { status: "active", expiresAt: new Date(Date.now() + THIRTY_DAYS), expiryReminderAt: null },
  });
}

export interface AdminListingRow {
  id: string; title: string; status: string; images: string[];
  views: number; createdAt: Date; expiresAt: Date;
  seller: { email: string };
}

export async function adminSearchListings(q: string): Promise<AdminListingRow[]> {
  const term = q.trim();
  const rows = await db.listing.findMany({
    where: term
      ? {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { user: { email: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, title: true, status: true, images: true, views: true,
      createdAt: true, expiresAt: true,
      user: { select: { email: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    images: r.images,
    views: r.views,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    seller: { email: r.user.email },
  }));
}
