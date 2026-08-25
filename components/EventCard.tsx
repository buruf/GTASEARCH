import Link from "next/link";
import { getCityLabel } from "@/lib/cities";
import { formatEventDates, eventTiming, type EventRow } from "@/lib/events";

export function EventCard({ event, now }: { event: EventRow; now?: Date }) {
  const timing = eventTiming(event.startsAt, event.endsAt, now);

  return (
    <article className="group h-full overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line transition-shadow hover:shadow-card-hover">
      <Link href={`/events/${event.slug}`} className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            {formatEventDates(event.startsAt, event.endsAt)}
          </p>
          {timing && (
            <span className="shrink-0 rounded-btn bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-dark">
              {timing}
            </span>
          )}
        </div>

        {/* h2: cards sit directly under the page h1, and h1->h3 fails the
            heading-order audit (the BusinessCard lesson). */}
        <h2 className="mt-2 line-clamp-2 text-sm font-semibold text-ink">{event.name}</h2>

        <p className="mt-1 line-clamp-1 text-xs text-ink-muted">
          {event.venueName ?? getCityLabel(event.city)}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-3">
          {event.free ? (
            <span className="rounded-btn bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
              Free
            </span>
          ) : event.priceNote ? (
            <span className="text-[11px] text-ink-faint">{event.priceNote}</span>
          ) : null}
          <span className="ml-auto text-[11px] text-ink-faint">
            {getCityLabel(event.city)}
          </span>
        </div>
      </Link>
    </article>
  );
}

export function EventGrid({ events, now }: { events: EventRow[]; now?: Date }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {events.map((e) => (
        <li key={e.id}>
          <EventCard event={e} now={now} />
        </li>
      ))}
    </ul>
  );
}
