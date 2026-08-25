// Local events — Phase 5D.
//
// Reads only. Events are written by scripts/import-toronto-events.ts (City of
// Toronto Festivals & Events, Open Government Licence – Toronto) and, later,
// by business owners posting their own.
//
// One rule runs through every query here: an event that has already finished
// is not a listing, it is history. Nothing in this module returns a finished
// event, so no page can accidentally show one — the alternative is a visitor
// turning up to a festival that ended in March.

import { db } from "@/lib/db";
import { getCity } from "@/lib/cities";

export const EVENTS_PAGE_SIZE = 24;

export interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string | null;
  startsAt: Date;
  endsAt: Date;
  venueName: string | null;
  address: string | null;
  city: string;
  priceNote: string | null;
  free: boolean;
  website: string | null;
  imageUrl: string | null;
}

const ROW_FIELDS = {
  id: true, slug: true, name: true, description: true, category: true,
  startsAt: true, endsAt: true, venueName: true, address: true, city: true,
  priceNote: true, free: true, website: true, imageUrl: true,
} as const;

/** Published, not yet finished. The single source of "is this a listing". */
function liveWhere(now: Date) {
  return { status: "published", endsAt: { gte: now } };
}

/**
 * Soonest-first page of upcoming events.
 *
 * Ordering is startsAt then id: without the id tiebreaker, events sharing a
 * start date shuffle between pages, which is the pagination bug this project
 * already hit once on listings and once on businesses.
 */
export async function upcomingEvents(opts: {
  city?: string;
  free?: boolean;
  page?: number;
  now?: Date;
} = {}): Promise<{ events: EventRow[]; total: number; page: number; pages: number }> {
  const now = opts.now ?? new Date();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const city = opts.city && getCity(opts.city) ? opts.city : undefined;

  const where = {
    ...liveWhere(now),
    ...(city ? { city } : {}),
    ...(opts.free ? { free: true } : {}),
  };

  const [total, events] = await Promise.all([
    db.event.count({ where }),
    db.event.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * EVENTS_PAGE_SIZE,
      take: EVENTS_PAGE_SIZE,
      select: ROW_FIELDS,
    }),
  ]);

  return { events, total, page, pages: Math.max(1, Math.ceil(total / EVENTS_PAGE_SIZE)) };
}

/** For the homepage strip. */
export async function soonestEvents(take = 4, now = new Date()): Promise<EventRow[]> {
  return db.event.findMany({
    where: liveWhere(now),
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take,
    select: ROW_FIELDS,
  });
}

/** Null for unknown or finished events, so the page 404s rather than showing
 *  something that is over. */
export async function getEvent(slug: string, now = new Date()): Promise<EventRow | null> {
  const event = await db.event.findFirst({
    where: { slug, ...liveWhere(now) },
    select: ROW_FIELDS,
  });
  return event ?? null;
}

/** Live counts per city, for count-gated filter chips. */
export async function eventCityCounts(now = new Date()): Promise<Record<string, number>> {
  const rows = await db.event.groupBy({
    by: ["city"],
    where: liveWhere(now),
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.city] = r._count._all;
  return out;
}

export async function liveEventCount(now = new Date()): Promise<number> {
  return db.event.count({ where: liveWhere(now) });
}

/** Other events to show on a detail page — same city, excluding this one. */
export async function relatedEvents(event: EventRow, take = 4, now = new Date()): Promise<EventRow[]> {
  return db.event.findMany({
    where: { ...liveWhere(now), city: event.city, id: { not: event.id } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take,
    select: ROW_FIELDS,
  });
}

/**
 * "8 August 2026", or "8–12 August 2026" for a run of days.
 *
 * Single-day events are the common case and should not read as a range. A
 * multi-day run collapses the shared month and year rather than repeating
 * them, because "8 August 2026 – 12 August 2026" is noise on a card.
 */
export function formatEventDates(startsAt: Date, endsAt: Date): string {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { day: "numeric", timeZone: "America/Toronto" }).format(d);
  const monthYear = (d: Date) => new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "America/Toronto" }).format(d);
  const full = (d: Date) => new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" }).format(d);

  if (full(startsAt) === full(endsAt)) return full(startsAt);
  if (monthYear(startsAt) === monthYear(endsAt)) {
    return `${day(startsAt)}–${day(endsAt)} ${monthYear(startsAt)}`;
  }
  return `${full(startsAt)} – ${full(endsAt)}`;
}

/** "On now" / "Tomorrow" / "In 3 days" — how close it is, in plain words. */
export function eventTiming(startsAt: Date, endsAt: Date, now = new Date()): string {
  if (startsAt <= now && endsAt >= now) return "On now";
  const days = Math.ceil((startsAt.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "Next week";
  return "";
}
