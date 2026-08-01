import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessGrid } from "@/components/BusinessCard";
import { DirectoryPagination } from "../../_components/DirectoryPagination";
import {
  BUSINESS_PAGE_SIZE,
  browseBusinesses,
  businessCategoryCountsForCity,
  businessCityCounts,
} from "@/lib/business";
import {
  getBusinessCategory,
  getBusinessCategoryLabel,
  getBusinessSubcategoryLabel,
} from "@/lib/business-categories";
import { getCity, getCityLabel } from "@/lib/cities";
import { CHIP_ACTIVE, CHIP_INACTIVE, parsePage } from "../../shared";

type Params = { category: string; city: string };
type SearchParams = { sub?: string; page?: string };

/** Resolves the validated ?sub value (or undefined) for a given category. */
function resolveSub(
  category: ReturnType<typeof getBusinessCategory>,
  rawSub: string | undefined,
): string | undefined {
  if (!category) return undefined;
  return category.subcategories.some((s) => s.slug === rawSub) ? rawSub : undefined;
}

/** Builds the H1 / title, honouring an active subcategory filter. */
function buildHeading(
  category: NonNullable<ReturnType<typeof getBusinessCategory>>,
  cityLabel: string,
  sub: string | undefined,
): string {
  const subLabel = sub ? getBusinessSubcategoryLabel(category.slug, sub) : null;
  return `${subLabel ?? category.label} in ${cityLabel}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const category = getBusinessCategory(params.category);
  const city = getCity(params.city);
  if (!category || !city) return { title: "Not found" };

  const sub = resolveSub(category, searchParams.sub);
  const h1 = buildHeading(category, city.label, sub);

  // Canonical must match what generated the title: a valid ?sub changes both
  // the H1 and the title, so it stays in the canonical too. ?page is
  // deliberately left out — paginated pages canonicalizing to page 1 is
  // standard and fine.
  const base = `/directory/${category.slug}/${city.slug}`;
  const canonical = sub ? `${base}?sub=${sub}` : base;

  return {
    title: `${h1} | GTASearch Directory`,
    description: `Find ${h1.toLowerCase()} — addresses, phone numbers and websites on GTASearch.`,
    alternates: { canonical },
  };
}

export default async function DirectoryCategoryCityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const category = getBusinessCategory(params.category);
  const city = getCity(params.city);
  if (!category || !city) notFound();

  const sub = resolveSub(category, searchParams.sub);
  const page = parsePage(searchParams.page);
  const h1 = buildHeading(category, city.label, sub);

  const [cityCounts, categoryCounts, { rows, total }] = await Promise.all([
    businessCityCounts(category.slug),
    businessCategoryCountsForCity(city.slug),
    browseBusinesses(category.slug, city.slug, page, sub),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / BUSINESS_PAGE_SIZE));

  const buildHref = (overrides: { sub?: string | undefined; page?: number }): string => {
    const effectiveSub = "sub" in overrides ? overrides.sub : sub;
    const effectivePage = overrides.page ?? page;
    const p = new URLSearchParams();
    if (effectiveSub) p.set("sub", effectiveSub);
    if (effectivePage > 1) p.set("page", String(effectivePage));
    const qs = p.toString();
    const base = `/directory/${category.slug}/${city.slug}`;
    return qs ? `${base}?${qs}` : base;
  };

  // Cross-link: the same category in other GTA cities that actually have
  // businesses in it.
  const otherCities = Object.entries(cityCounts)
    .filter(([slug, count]) => slug !== city.slug && count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // Cross-link: other categories in this city with at least one business —
  // count-gated so crawlers don't get walked into empty category×city pages
  // the sitemap deliberately excludes.
  const otherCategories = Object.entries(categoryCounts)
    .filter(([slug, count]) => slug !== category.slug && count > 0)
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
          <li>
            <Link href={`/directory/${category.slug}`} className="hover:text-brand">
              {category.label}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink" aria-current="page">
            {city.label}
          </li>
        </ol>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">{h1}</h1>

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

      <section className="mt-8">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No businesses found in {city.label} yet.
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

      {otherCities.length > 0 && (
        <section className="mt-10" aria-labelledby="directory-other-cities-heading">
          <h2
            id="directory-other-cities-heading"
            className="text-sm font-bold text-ink"
          >
            {category.label} in other GTA cities
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {otherCities.map(([slug, count]) => (
              <li key={slug}>
                <Link href={`/directory/${category.slug}/${slug}`} className={CHIP_INACTIVE}>
                  {getCityLabel(slug)} ({count})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {otherCategories.length > 0 && (
        <section className="mt-8" aria-labelledby="directory-other-categories-heading">
          <h2
            id="directory-other-categories-heading"
            className="text-sm font-bold text-ink"
          >
            Other categories in {city.label}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {otherCategories.map(([slug, count]) => (
              <li key={slug}>
                <Link href={`/directory/${slug}/${city.slug}`} className={CHIP_INACTIVE}>
                  {getBusinessCategoryLabel(slug)} ({count})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
