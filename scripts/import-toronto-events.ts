// City of Toronto Festivals & Events import (Phase 5D).
//
// ---------------------------------------------------------------------
// Source (verified live 2026-08-05):
//   Package: festivals-events on the Toronto CKAN portal
//   Licence: Open Government Licence – Toronto (portal-wide; the per-dataset
//            licence field is blank, but this is the same portal and the same
//            licence already credited on /data-sources for the business
//            licence and public-health feeds).
//   Content: "festivals, special events and exhibits approved to appear on the
//            City of Toronto Festivals and Events Calendar. All details are
//            submitted by the event's organizer and reviewed by City of
//            Toronto Tourism Services staff." Organiser-authored, City-checked
//            — real events, not generated ones.
//
//   The dataset lists TWO JSON resources and the primary one is broken: it
//   serves an HTML error page. The City published a second, explicitly named
//   "Temporary Festival and Events Feed (while the other is broken)". This
//   script uses the temporary feed and will need revisiting if the City ever
//   repairs the first — hence FEED_URL being a single named constant.
//
// ---------------------------------------------------------------------
// THE SHAPE THAT MATTERS: the feed publishes ONE ROW PER OCCURRENCE DATE.
// A month-long exhibition appears thirty times, once per day it runs; 21,000
// rows collapse to a few hundred real events. Importing rows as-is would fill
// the events page with the same festival repeated down the screen. So rows are
// grouped and stored once, spanning the earliest start and the latest end.
//
// Group on `submission_id`, NOT `id`. The first version used `id` and
// collapsed nothing — a dry run reported 5,384 "distinct" events whose
// soonest eight were all the same Royal Ontario Museum evening. Measured on a
// 1,000-row sample: `id` 1,000 distinct values, `submission_id` 186, matching
// the 186 distinct event names exactly.
//
// Usage:
//   npx tsx scripts/import-toronto-events.ts [--dry-run] [--limit N]

import "dotenv/config";
import { db } from "@/lib/db";
import { CITIES } from "@/lib/cities";
import { cleanAddress, normalizeWebsite, repairMojibake } from "./import-helpers";
import { districtFromPostal } from "./toronto-districts";

const FEED_URL =
  "https://secure.toronto.ca/c3api_data/v2/DataAccess.svc/festivals_events/events";
const PAGE = 1000;
const SAFETY_MAX_ROWS = 40_000;
const HARD_CAP = 5_000; // events written per run
const WRITE_CHUNK = 200;

interface FeedRow {
  /** Row-level id — UNIQUE PER OCCURRENCE DATE, useless for grouping. */
  id?: string | number;
  /**
   * The event-level identifier, and the one to group on. Measured against a
   * 1,000-row sample of the live feed: `id` took 1,000 distinct values,
   * `submission_id` took 186 — exactly the number of distinct event names in
   * the same rows. `calendar_id` took 11 and is the calendar the event sits
   * on, far too coarse.
   */
  submission_id?: string | number | null;
  event_name?: string | null;
  event_description?: string | null;
  short_description?: string | null;
  event_category?: string[] | string | null;
  event_startdate?: string | null;
  event_enddate?: string | null;
  event_status?: string | null;
  /** Array of location OBJECTS (location_name, location_address, …). */
  event_locations?: unknown;
  event_website?: string | null;
  event_image?: string | null;
  event_price?: string | null;
  free_event?: string | null;
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const first = (v: string[] | string | null | undefined): string | null => {
  if (Array.isArray(v)) return str(v[0]);
  return str(v);
};

/**
 * Reads venue, address and city out of a feed row.
 *
 * `event_locations` is an array of OBJECTS, not strings — the first version of
 * this read it as text, stringified `[object Object]`, matched no city, and
 * discarded all 5,384 live events. The fields that matter are `location_name`
 * and `location_address`.
 *
 * City is resolved in three steps, most reliable first:
 *   1. The postal code in the address, through the same FSA table the business
 *      importer uses — this is what correctly separates Etobicoke and
 *      Scarborough from Toronto proper.
 *   2. A municipality name appearing in the address text, longest match first
 *      so "East Gwillimbury" is not beaten by a stray "York".
 *   3. Toronto. This is a default, not a guess: the source IS the City of
 *      Toronto's own events calendar, so an approved entry on it is an event
 *      in Toronto. Some venues are published as a boundary with no street
 *      address at all ("Kensington Market"), and dropping those would lose
 *      real events over a missing field.
 */
export function parseLocation(loc: unknown): {
  venueName: string | null;
  address: string | null;
  city: string;
} {
  const obj = (Array.isArray(loc) ? loc[0] : loc) as Record<string, unknown> | null;
  if (!obj || typeof obj !== "object") {
    return { venueName: null, address: null, city: "toronto" };
  }

  const venueName = str(repairMojibake(String(obj.location_name ?? "")));
  const rawAddress = str(repairMojibake(String(obj.location_address ?? "")));

  let city: string | null = null;

  if (rawAddress) {
    const postal = rawAddress.match(/\b([A-Za-z]\d[A-Za-z])\s*\d[A-Za-z]\d\b/);
    if (postal) city = districtFromPostal(postal[1]);

    if (!city) {
      // Match whole address COMPONENTS, not substrings. "115 King St E,
      // Toronto" contains "King" and a substring match filed it under King
      // Township; a Toronto street is not a municipality. Splitting on commas
      // means only a part that IS the city name counts.
      const parts = rawAddress.split(",").map((p) => p.trim().toLowerCase());
      let bestLen = 0;
      for (const c of CITIES) {
        const needle = c.label.toLowerCase();
        const hit = parts.some((p) => p === needle || p.startsWith(`${needle} on`));
        if (hit && needle.length > bestLen) {
          city = c.slug;
          bestLen = needle.length;
        }
      }
    }
  }

  const address = rawAddress
    ? cleanAddress(rawAddress.replace(/,\s*(ON|Ontario)\b.*$/i, "").trim()) || null
    : null;

  return { venueName, address, city: city ?? "toronto" };
}

/** Slug from name + city, with the year appended: annual festivals repeat. */
export function eventSlug(name: string, city: string, startsAt: Date): string {
  const base = name
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return `${base || "event"}-${city}-${startsAt.getUTCFullYear()}`;
}

interface Grouped {
  sourceId: string;
  name: string;
  description: string;
  category: string | null;
  startsAt: Date;
  endsAt: Date;
  venueName: string | null;
  address: string | null;
  city: string;
  website: string | null;
  imageUrl: string | null;
  priceNote: string | null;
  free: boolean;
}

function parseArgs(argv: string[]) {
  let dryRun = false;
  let limit = HARD_CAP;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--limit" || a.startsWith("--limit=")) {
      const n = Number(a.startsWith("--limit=") ? a.slice(8) : argv[++i]);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { dryRun, limit: Math.min(limit, HARD_CAP) };
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));
  console.log(`Toronto events import — ${dryRun ? "DRY RUN" : "LIVE RUN"}, limit=${limit}\n`);

  const now = new Date();
  const groups = new Map<string, Grouped>();
  const counters = {
    scanned: 0,
    skippedFinished: 0,
    skippedNotApproved: 0,
    skippedNoName: 0,
    skippedNoDate: 0,
    skippedNoSourceId: 0,
    mergedDuplicateSubmissions: 0,
  };

  let skip = 0;
  for (;;) {
    const url = `${FEED_URL}?$format=application/json;odata.metadata=none&$skip=${skip}&$top=${PAGE}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
    const body = (await res.json()) as FeedRow[] | { value?: FeedRow[] };
    const rows = Array.isArray(body) ? body : (body.value ?? []);
    if (!rows.length) break;

    for (const r of rows) {
      counters.scanned++;

      // The City only publishes approved events, but assert it rather than
      // assume — this is the field that says a human checked the entry.
      if (str(r.event_status) && str(r.event_status) !== "Approved") {
        counters.skippedNotApproved++;
        continue;
      }
      const name = str(r.event_name);
      if (!name) { counters.skippedNoName++; continue; }

      const startRaw = str(r.event_startdate);
      const endRaw = str(r.event_enddate);
      if (!startRaw || !endRaw) { counters.skippedNoDate++; continue; }
      const startsAt = new Date(startRaw);
      const endsAt = new Date(endRaw);
      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
        counters.skippedNoDate++;
        continue;
      }
      // Anything already over is history, not a listing.
      if (endsAt < now) { counters.skippedFinished++; continue; }

      const loc = parseLocation(r.event_locations);

      // submission_id, NOT id — see the FeedRow comment. Grouping on `id`
      // collapsed nothing, because the feed mints a fresh one for every
      // occurrence date.
      const sourceId = str(r.submission_id);
      if (!sourceId) { counters.skippedNoSourceId++; continue; }

      const description =
        repairMojibake(str(r.event_description) ?? str(r.short_description) ?? "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000);

      const existing = groups.get(sourceId);
      if (existing) {
        // Same event, another occurrence date: widen the span.
        if (startsAt < existing.startsAt) existing.startsAt = startsAt;
        if (endsAt > existing.endsAt) existing.endsAt = endsAt;
        continue;
      }

      groups.set(sourceId, {
        sourceId,
        name: repairMojibake(name).slice(0, 200),
        description,
        category: first(r.event_category),
        startsAt,
        endsAt,
        venueName: loc.venueName?.slice(0, 160) ?? null,
        address: loc.address?.slice(0, 200) ?? null,
        city: loc.city,
        website: normalizeWebsite(str(r.event_website)),
        imageUrl: str(r.event_image),
        priceNote: str(r.event_price),
        free: String(r.free_event ?? "").toLowerCase() === "yes",
      });
    }

    skip += PAGE;
    process.stderr.write(`\r  scanned ${counters.scanned}, distinct events ${groups.size}`);
    if (rows.length < PAGE || skip >= SAFETY_MAX_ROWS) break;
  }
  process.stderr.write("\n");

  // Second pass: the City's feed itself carries duplicate SUBMISSIONS — the
  // same organiser entering the same event twice, each with its own
  // submission_id. "Canadian Disability Tech Summit" appears twice on the same
  // date at the same venue, "Toronto Sunday Market" twice at Parkdale Hall
  // over overlapping runs. Grouping by submission_id cannot see these, so
  // merge anything with the same name and venue whose dates overlap, keeping
  // the widest span. Requiring the venue to match as well is what stops two
  // genuinely different "Farmers' Market" events from being fused.
  const merged = new Map<string, Grouped>();
  let mergedAway = 0;
  for (const e of [...groups.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    const key = `${e.name.toLowerCase()}|${(e.venueName ?? "").toLowerCase()}|${e.city}`;
    const prev = merged.get(key);
    if (prev && e.startsAt <= prev.endsAt && e.endsAt >= prev.startsAt) {
      if (e.startsAt < prev.startsAt) prev.startsAt = e.startsAt;
      if (e.endsAt > prev.endsAt) prev.endsAt = e.endsAt;
      mergedAway++;
      continue;
    }
    merged.set(prev ? `${key}|${e.sourceId}` : key, e);
  }
  counters.mergedDuplicateSubmissions = mergedAway;

  const events = [...merged.values()]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, limit);

  console.log("\nCounters:");
  for (const [k, v] of Object.entries(counters)) console.log(`  ${k.padEnd(22)} ${v}`);
  console.log(`  ${"distinctEvents".padEnd(22)} ${groups.size}`);
  console.log(`  ${"toWrite".padEnd(22)} ${events.length}`);

  const byCity = new Map<string, number>();
  for (const e of events) byCity.set(e.city, (byCity.get(e.city) ?? 0) + 1);
  console.log("\nPer city:");
  for (const [c, n] of [...byCity].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(22)} ${n}`);
  }

  console.log("\nSoonest 8:");
  for (const e of events.slice(0, 8)) {
    console.log(`  ${e.startsAt.toISOString().slice(0, 10)}  ${e.name} — ${e.venueName ?? e.city}`);
  }

  if (dryRun) {
    console.log("\nDRY RUN — nothing written.");
    await db.$disconnect();
    return;
  }

  // Slugs are resolved in memory against every slug already stored, the same
  // way the business importers do it — a query per row is what killed the
  // Toronto business import at scale.
  const taken = new Set(
    (await db.event.findMany({ select: { slug: true } })).map((e) => e.slug),
  );
  let written = 0;
  for (let i = 0; i < events.length; i += WRITE_CHUNK) {
    const chunk = events.slice(i, i + WRITE_CHUNK);
    await db.$transaction(
      chunk.map((e) => {
        let slug = eventSlug(e.name, e.city, e.startsAt);
        let n = 2;
        while (taken.has(slug)) slug = `${eventSlug(e.name, e.city, e.startsAt)}-${n++}`;
        taken.add(slug);
        const data = {
          name: e.name,
          description: e.description,
          category: e.category,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          venueName: e.venueName,
          address: e.address,
          city: e.city,
          website: e.website,
          imageUrl: e.imageUrl,
          priceNote: e.priceNote,
          free: e.free,
        };
        return db.event.upsert({
          where: { source_sourceId: { source: "open-data", sourceId: e.sourceId } },
          // On re-import the dates and details refresh; the slug is left alone
          // so a URL that has been shared or indexed keeps working.
          update: data,
          create: { ...data, slug, source: "open-data", sourceId: e.sourceId },
        });
      }),
    );
    written += chunk.length;
    process.stdout.write(`\r  written ${written}/${events.length}`);
  }
  console.log("");

  const live = await db.event.count({ where: { status: "published", endsAt: { gte: new Date() } } });
  console.log(`\nlive events in the database: ${live}`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("\nEvents import failed:", err);
  process.exit(1);
});
