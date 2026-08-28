import type { Metadata } from "next";
import Link from "next/link";
import { NearMe } from "@/components/NearMe";
import { coordinateCoverage } from "@/lib/near";
import { CITIES, cityRank } from "@/lib/cities";
import { businessCityCounts } from "@/lib/business";

export const metadata: Metadata = {
  title: "Businesses Near Me",
  description:
    "Find businesses closest to you across the Greater Toronto Area — restaurants, dentists, salons, trades and more, sorted by distance.",
  alternates: { canonical: "/near-me" },
};

export default async function NearMePage() {
  const [{ located, total }, cityCounts] = await Promise.all([
    coordinateCoverage(),
    businessCityCounts(),
  ]);

  // The fallback for anyone who declines location, and the crawlable content
  // on a page whose main feature needs JavaScript and a permission prompt.
  const cities = CITIES.filter((c) => (cityCounts[c.slug] ?? 0) > 0).sort(
    (a, b) => cityRank(a.slug) - cityRank(b.slug),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink" aria-current="page">
            Near me
          </li>
        </ol>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">Businesses near me</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Share your location and we&apos;ll show the closest businesses first,
        with the distance to each.
      </p>

      <div className="mt-6">
        <NearMe located={located} total={total} />
      </div>

      <section aria-labelledby="browse-city-heading" className="mt-10">
        <h2 id="browse-city-heading" className="text-sm font-semibold text-ink">
          Or browse by city
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {cities.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/directory/restaurants/${c.slug}`}
                className="inline-block rounded-btn border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand hover:text-brand"
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
