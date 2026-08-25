import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EventGrid } from "@/components/EventCard";
import { getCityLabel } from "@/lib/cities";
import { getEvent, relatedEvents, formatEventDates, eventTiming } from "@/lib/events";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event not found" };

  const where = event.venueName ?? getCityLabel(event.city);
  return {
    title: `${event.name} — ${where}`,
    description:
      event.description.slice(0, 155) ||
      `${event.name} at ${where}, ${formatEventDates(event.startsAt, event.endsAt)}.`,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      title: event.name,
      description: event.description.slice(0, 200),
      type: "article",
      ...(event.imageUrl ? { images: [event.imageUrl] } : {}),
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEvent(slug);
  // getEvent returns null for finished events too, so a page for something
  // that is over 404s rather than sending someone to a closed festival.
  if (!event) notFound();

  const related = await relatedEvents(event);
  const timing = eventTiming(event.startsAt, event.endsAt);
  const mapsUrl = event.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${event.venueName ?? ""} ${event.address}`.trim(),
      )}`
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-brand">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/events" className="hover:text-brand">Events</Link></li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/events?city=${event.city}`} className="hover:text-brand">
              {getCityLabel(event.city)}
            </Link>
          </li>
        </ol>
      </nav>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            {formatEventDates(event.startsAt, event.endsAt)}
          </p>
          {timing && (
            <span className="rounded-btn bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-dark">
              {timing}
            </span>
          )}
          {event.free && (
            <span className="rounded-btn bg-brand px-2 py-0.5 text-xs font-semibold text-white">
              Free
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{event.name}</h1>
        {event.category && (
          <p className="mt-1 text-sm text-ink-muted">{event.category}</p>
        )}
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {event.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
              {event.description}
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              No description was published for this event.
            </p>
          )}
        </div>

        <aside className="h-fit rounded-card border border-line bg-surface-alt p-4">
          <h2 className="text-sm font-semibold text-ink">Details</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">When</dt>
              <dd className="text-ink">{formatEventDates(event.startsAt, event.endsAt)}</dd>
            </div>
            {(event.venueName || event.address) && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">Where</dt>
                <dd className="text-ink">
                  {event.venueName && <span className="block font-medium">{event.venueName}</span>}
                  {event.address && <span className="block text-ink-muted">{event.address}</span>}
                  <span className="block text-ink-muted">{getCityLabel(event.city)}</span>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">Price</dt>
              {/* Printed exactly as the organiser published it. Never derived:
                  a price we computed is how someone arrives with the wrong
                  money. */}
              <dd className="text-ink">
                {event.free ? "Free" : (event.priceNote ?? "See event website")}
              </dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            {event.website && (
              <a
                href={event.website}
                target="_blank"
                rel="nofollow noopener"
                className="block rounded-btn bg-brand px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Event website
              </a>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="nofollow noopener"
                className="block rounded-btn border border-line bg-surface px-4 py-2 text-center text-sm font-medium text-ink hover:border-brand hover:text-brand"
              >
                View on map
              </a>
            )}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
            Listed from the City of Toronto&apos;s events calendar. Details are
            the organiser&apos;s — check the event website before travelling.
          </p>
        </aside>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-12">
          <h2 id="related-heading" className="text-lg font-bold text-ink">
            More in {getCityLabel(event.city)}
          </h2>
          <div className="mt-4">
            <EventGrid events={related} />
          </div>
        </section>
      )}
    </div>
  );
}
