import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessGrid } from "@/components/BusinessCard";
import { DirectoryPagination } from "../_components/DirectoryPagination";
import {
  BUSINESS_PAGE_SIZE,
  browseBusinesses,
  businessCityCounts,
} from "@/lib/business";
import { getBusinessCategory } from "@/lib/business-categories";
import { getCityLabel } from "@/lib/cities";

type Params = { category: string };
type SearchParams = { sub?: string; page?: string };

const CHIP_BASE =
  "inline-block rounded-btn border px-3 py-1.5 text-xs font-medium";
const CHIP_ACTIVE = `${CHIP_BASE} border-brand bg-brand text-white`;
const CHIP_INACTIVE = `${CHIP_BASE} border-line bg-surface text-ink-muted hover:border-brand hover:text-brand`;

function parsePage(raw: string | undefined): number {
  const n = Number(raw ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const category = getBusinessCategory(params.category);
  if (!category) return { title: "Category not found" };

  return {
    title: `${category.label} in the GTA | GTASearch Directory`,
    alternates: { canonical: `/directory/${category.slug}` },
  };
}

export default async function DirectoryCategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const category = getBusinessCategory(params.category);
  if (!category) notFound();

  // Unknown ?sub values are dropped, not 404'd — directory URLs are
  // user-editable, same rule as the classifieds search filters.
  const sub = category.subcategories.some((s) => s.slug === searchParams.sub)
    ? searchParams.sub
    : undefined;
  const page = parsePage(searchParams.page);

  const [cityCounts, { rows, total }] = await Promise.all([
    businessCityCounts(category.slug),
    browseBusinesses(category.slug, undefined, page, sub),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / BUSINESS_PAGE_SIZE));

  const buildHref = (overrides: { sub?: string | undefined; page?: number }): string => {
    const effectiveSub = "sub" in overrides ? overrides.sub : sub;
    const effectivePage = overrides.page ?? page;
    const p = new URLSearchParams();
    if (effectiveSub) p.set("sub", effectiveSub);
    if (effectivePage > 1) p.set("page", String(effectivePage));
    const qs = p.toString();
    return qs ? `/directory/${category.slug}?${qs}` : `/directory/${category.slug}`;
  };

  const cities = Object.entries(cityCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/directory" className="hover:text-brand">
              Directory
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink" aria-current="page">
            {category.label}
          </li>
        </ol>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">
        {category.label} in the GTA
      </h1>

      {category.subcategories.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          <li>
            <Link
              href={buildHref({ sub: undefined, page: 1 })}
              aria-current={!sub ? "page" : undefined}
              className={!sub ? CHIP_ACTIVE : CHIP_INACTIVE}
            >
              All {category.label}
            </Link>
          </li>
          {category.subcategories.map((s) => (
            <li key={s.slug}>
              <Link
                href={buildHref({ sub: s.slug, page: 1 })}
                aria-current={sub === s.slug ? "page" : undefined}
                className={sub === s.slug ? CHIP_ACTIVE : CHIP_INACTIVE}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {cities.length > 0 && (
        <section className="mt-6" aria-labelledby="directory-category-city-heading">
          <h2
            id="directory-category-city-heading"
            className="text-sm font-bold text-ink"
          >
            Browse by city
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {cities.map(([citySlug, count]) => (
              <li key={citySlug}>
                <Link
                  href={`/directory/${category.slug}/${citySlug}`}
                  className={CHIP_INACTIVE}
                >
                  {getCityLabel(citySlug)} ({count})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No businesses found in this category yet.
          </p>
        ) : (
          <>
            <BusinessGrid businesses={rows} />
            <DirectoryPagination
              page={Math.min(page, totalPages)}
              totalPages={totalPages}
              buildHref={(p) => buildHref({ page: p })}
            />
          </>
        )}
      </section>
    </div>
  );
}
