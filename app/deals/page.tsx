import type { Metadata } from "next";
import Link from "next/link";
import { DealGrid } from "@/components/DealCard";
import { DealsNearMe } from "@/components/DealsNearMe";
import { DirectoryPagination } from "@/app/directory/_components/DirectoryPagination";
import { liveDeals, DEALS_PAGE_SIZE } from "@/lib/deals";
import { CITIES, getCityLabel, cityRank } from "@/lib/cities";
import { BUSINESS_CATEGORIES, getBusinessCategoryLabel } from "@/lib/business-categories";

export const metadata: Metadata = {
  title: "Deals & Coupons in the GTA",
  description:
    "Current offers from local businesses across the Greater Toronto Area — posted by the owners themselves, and always with an end date.",
  alternates: { canonical: "/deals" },
};

interface Props {
  searchParams: Promise<{ city?: string; category?: string; page?: string }>;
}

export default async function DealsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  // Unknown values degrade to "all" rather than 500 — these URLs are
  // user-editable, the same rule the other browse pages follow.
  const city = params.city && CITIES.some((c) => c.slug === params.city) ? params.city : undefined;
  const category =
    params.category && BUSINESS_CATEGORIES.some((c) => c.slug === params.category)
      ? params.category
      : undefined;

  const { rows, total, pages } = await liveDeals({ city, category, page });

  const buildHref = (p: number) => {
    const q = new URLSearchParams();
    if (city) q.set("city", city);
    if (category) q.set("category", category);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/deals?${s}` : "/deals";
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink" aria-current="page">Deals</li>
        </ol>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">
        {city ? `Deals in ${getCityLabel(city)}` : "Deals and coupons across the GTA"}
        {category ? ` — ${getBusinessCategoryLabel(category)}` : ""}
      </h1>

      <div className="mt-5">
        <DealsNearMe />
      </div>

      {total === 0 ? (
        // Honest empty state. Every deal here is written by a business owner,
        // so until owners start claiming their listings there is nothing to
        // show — and inventing offers to fill the page would send people to
        // shops expecting prices that do not exist.
        <div className="mt-6 rounded-card border border-line bg-surface-alt p-6">
          <h2 className="text-base font-semibold text-ink">No deals running yet</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Every deal on GTASearch is posted by the business itself. We never
            write offers on a business&apos;s behalf, because an invented
            discount sends you somewhere expecting a price that does not exist.
            As owners claim their listings, their offers will appear here.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Browse the directory
            </Link>
            <Link
              href="/contact"
              className="rounded-btn border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand"
            >
              Own a business? Claim your listing
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-ink-muted">
            {total.toLocaleString("en-CA")} {total === 1 ? "deal" : "deals"} running now,
            ending soonest first
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/deals"
              className={`inline-block rounded-btn border px-3 py-1.5 text-xs font-medium ${
                !city && !category
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-muted hover:border-brand hover:text-brand"
              }`}
            >
              All
            </Link>
            {CITIES.slice()
              .sort((a, b) => cityRank(a.slug) - cityRank(b.slug))
              .slice(0, 8)
              .map((c) => (
                <Link
                  key={c.slug}
                  href={`/deals?city=${c.slug}`}
                  className={`inline-block rounded-btn border px-3 py-1.5 text-xs font-medium ${
                    city === c.slug
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-ink-muted hover:border-brand hover:text-brand"
                  }`}
                >
                  {c.label}
                </Link>
              ))}
          </div>

          <div className="mt-5">
            <DealGrid deals={rows} />
          </div>

          {total > DEALS_PAGE_SIZE && (
            <DirectoryPagination page={page} totalPages={pages} buildHref={buildHref} />
          )}
        </>
      )}
    </div>
  );
}
