import type { Metadata } from "next";
import Link from "next/link";
import { EventGrid } from "@/components/EventCard";
import { DirectoryPagination } from "@/app/directory/_components/DirectoryPagination";
import { CITIES, getCityLabel, cityRank } from "@/lib/cities";
import { upcomingEvents, eventCityCounts, EVENTS_PAGE_SIZE } from "@/lib/events";

export const metadata: Metadata = {
  title: "Local Events in the GTA",
  description:
    "Festivals, markets, exhibitions and things to do across the Greater Toronto Area — dates, venues and prices, from the City of Toronto's events calendar.",
  alternates: { canonical: "/events" },
};

interface Props {
  searchParams: Promise<{ city?: string; free?: string; page?: string }>;
}

export default async function EventsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const free = params.free === "1";
  // An unknown city degrades to "all", never a 500 — search URLs are
  // user-editable (the same rule lib/search.ts follows).
  const city = params.city && CITIES.some((c) => c.slug === params.city) ? params.city : undefined;

  const [{ events, total, pages }, cityCounts] = await Promise.all([
    upcomingEvents({ city, free, page }),
    eventCityCounts(),
  ]);

  // Count-gated, like every other filter strip on the site: a chip that leads
  // to an empty page teaches people the filters are broken.
  const cities = CITIES.filter((c) => (cityCounts[c.slug] ?? 0) > 0).sort(
    (a, b) => cityRank(a.slug) - cityRank(b.slug),
  );

  const buildHref = (p: number) => {
    const q = new URLSearchParams();
    if (city) q.set("city", city);
    if (free) q.set("free", "1");
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/events?${s}` : "/events";
  };

  const chipHref = (patch: { city?: string | null; free?: boolean }) => {
    const q = new URLSearchParams();
    const nextCity = patch.city === null ? undefined : (patch.city ?? city);
    const nextFree = patch.free ?? free;
    if (nextCity) q.set("city", nextCity);
    if (nextFree) q.set("free", "1");
    const s = q.toString();
    return s ? `/events?${s}` : "/events";
  };

  const chip = (active: boolean) =>
    `inline-block rounded-btn border px-3 py-1.5 text-xs font-medium ${
      active
        ? "border-brand bg-brand text-white"
        : "border-line bg-surface text-ink-muted hover:border-brand hover:text-brand"
    }`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink" aria-current="page">Events</li>
        </ol>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">
        {city ? `Events in ${getCityLabel(city)}` : "Local events across the GTA"}
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-ink-muted">
        Festivals, markets and exhibitions happening now or coming up. Sourced
        from the{" "}
        <Link href="/data-sources" className="underline hover:text-brand">
          City of Toronto&apos;s events calendar
        </Link>
        , where every entry is submitted by the organiser and reviewed by the City.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={chipHref({ city: null })} className={chip(!city)}>All GTA</Link>
        {cities.map((c) => (
          <Link key={c.slug} href={chipHref({ city: c.slug })} className={chip(city === c.slug)}>
            {c.label} <span className="opacity-70">{cityCounts[c.slug]}</span>
          </Link>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link href={chipHref({ free: !free })} className={chip(free)}>
          Free events only
        </Link>
      </div>

      <p className="mt-6 text-sm text-ink-muted">
        {total === 0
          ? "No upcoming events match that filter."
          : `${total.toLocaleString("en-CA")} upcoming ${total === 1 ? "event" : "events"}`}
      </p>

      {events.length > 0 && (
        <div className="mt-4">
          <EventGrid events={events} />
        </div>
      )}

      {total > EVENTS_PAGE_SIZE && (
        <DirectoryPagination page={page} totalPages={pages} buildHref={buildHref} />
      )}
    </div>
  );
}
