// Deals and coupons — Phase 5D.
//
// A deal only ever exists because a business owner wrote it. GTASearch never
// generates one: an invented discount sends somebody to a shop expecting a
// price that does not exist, which is worse for them and for the business than
// having no deals at all.
//
// Every deal expires, and every read here filters on that. An out-of-date
// coupon is the commonest complaint about directory sites, so a finished deal
// cannot be shown by any code path — the guard lives in one place rather than
// being remembered at each call site.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dealLimitFor, MAX_DEAL_DAYS } from "@/lib/plans";

export class DealError extends Error {}

export const DEALS_PAGE_SIZE = 24;

export interface DealRow {
  id: string;
  title: string;
  description: string;
  code: string | null;
  startsAt: Date;
  endsAt: Date;
  business: {
    slug: string;
    name: string;
    category: string;
    city: string;
    address: string;
    verified: boolean;
  };
}

const DEAL_SELECT = {
  id: true,
  title: true,
  description: true,
  code: true,
  startsAt: true,
  endsAt: true,
  business: {
    select: { slug: true, name: true, category: true, city: true, address: true, verified: true },
  },
} as const;

/** Published, started, not yet finished. The single definition of "live". */
function liveWhere(now: Date) {
  return {
    status: "published",
    startsAt: { lte: now },
    endsAt: { gt: now },
    // A deal on a hidden business must disappear with it.
    business: { status: "active" },
  } satisfies Prisma.DealWhereInput;
}

export async function liveDeals(opts: { city?: string; category?: string; page?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const page = Math.max(1, Math.floor(opts.page ?? 1));

  const where: Prisma.DealWhereInput = {
    ...liveWhere(now),
    ...(opts.city || opts.category
      ? {
          business: {
            status: "active",
            ...(opts.city ? { city: opts.city } : {}),
            ...(opts.category ? { category: opts.category } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.deal.count({ where }),
    db.deal.findMany({
      where,
      // Ending soonest first — a deal with two days left is more useful to
      // know about than one with two months. id breaks ties so pagination is
      // stable.
      orderBy: [{ endsAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * DEALS_PAGE_SIZE,
      take: DEALS_PAGE_SIZE,
      select: DEAL_SELECT,
    }),
  ]);

  return { rows, total, page, pages: Math.max(1, Math.ceil(total / DEALS_PAGE_SIZE)) };
}

/** Live deals for one business, shown on its profile. */
export async function dealsForBusiness(businessId: string, now = new Date()): Promise<DealRow[]> {
  return db.deal.findMany({
    where: { ...liveWhere(now), businessId },
    orderBy: [{ endsAt: "asc" }, { id: "asc" }],
    select: DEAL_SELECT,
  });
}

export async function liveDealCount(now = new Date()): Promise<number> {
  return db.deal.count({ where: liveWhere(now) });
}

/** Everything an owner has on a business, expired ones included, so they can
 *  see why a deal stopped showing rather than assuming it broke. */
export async function dealsForOwner(businessId: string) {
  return db.deal.findMany({
    where: { businessId },
    orderBy: [{ endsAt: "desc" }],
    select: { id: true, title: true, description: true, code: true, startsAt: true, endsAt: true, status: true },
  });
}

export interface DealInput {
  title: string;
  description: string;
  code: string;
  endsAt: Date;
}

/**
 * Creates a deal on a business the caller owns.
 *
 * The ownership check is a filtered write, not a read-then-write: passing
 * `claimedById` into the lookup means a caller who does not own the business
 * gets "not found" without a second query and without a window between the
 * two in which ownership could change.
 */
export async function createDeal(
  userId: string,
  businessId: string,
  input: DealInput,
  now = new Date(),
): Promise<string> {
  const business = await db.business.findFirst({
    where: { id: businessId, claimedById: userId, status: "active" },
    select: { id: true, plan: true, planRenewsAt: true },
  });
  if (!business) throw new DealError("That business is not yours to manage.");

  const maxEnd = new Date(now.getTime() + MAX_DEAL_DAYS * 86_400_000);
  if (input.endsAt <= now) throw new DealError("Choose an end date in the future.");
  if (input.endsAt > maxEnd) {
    throw new DealError(`A deal can run for at most ${MAX_DEAL_DAYS} days. Renew it when it ends.`);
  }

  // Count only LIVE deals against the allowance: an expired deal should not
  // permanently consume a slot.
  const active = await db.deal.count({
    where: { businessId, status: "published", endsAt: { gt: now } },
  });
  const limit = dealLimitFor(business.plan);
  if (active >= limit) {
    throw new DealError(
      limit === 1
        ? "You already have a deal running. End it first, or upgrade to Pro to run more at once."
        : `You already have ${limit} deals running, which is the maximum.`,
    );
  }

  const created = await db.deal.create({
    data: {
      businessId,
      title: input.title,
      description: input.description,
      code: input.code || null,
      startsAt: now,
      endsAt: input.endsAt,
    },
    select: { id: true },
  });
  return created.id;
}

/** Ends a deal now. Owner-only, and never a hard delete: the row stays so the
 *  owner can see what they ran, and so a moderation history survives. */
export async function endDeal(userId: string, dealId: string, now = new Date()): Promise<void> {
  const updated = await db.deal.updateMany({
    where: { id: dealId, business: { claimedById: userId } },
    data: { endsAt: now },
  });
  if (updated.count === 0) throw new DealError("That deal is not yours to manage.");
}

/** "Ends today" / "2 days left" — urgency in plain words. */
export function dealTimeLeft(endsAt: Date, now = new Date()): string {
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return "Ended";
  const days = Math.ceil(ms / 86_400_000);
  if (days === 1) return "Ends today";
  if (days === 2) return "Ends tomorrow";
  if (days <= 14) return `${days} days left`;
  return "";
}
