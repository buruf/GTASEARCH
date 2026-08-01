import Link from "next/link";

interface Props {
  page: number;
  totalPages: number;
  /** Builds the href for a given page number, preserving whatever other query
   *  params the caller cares about (e.g. `?sub=`). */
  buildHref: (page: number) => string;
}

/**
 * Plain anchor links — works without JavaScript and is crawlable. Visually
 * mirrors components/Pagination.tsx (the classifieds pagination), which is
 * typed to classifieds' SearchFilters and isn't reusable here, so this is a
 * small directory-local equivalent instead of modifying that component.
 */
export function DirectoryPagination({ page, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null;

  const current = Math.min(page, totalPages);

  // Show a compact window around the current page rather than every page.
  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - current) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  const linkClass =
    "flex h-10 min-w-10 items-center justify-center rounded-btn border px-3 text-sm font-medium";

  return (
    <nav aria-label="Pagination" className="mt-8 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          {current > 1 ? (
            <Link
              href={buildHref(current - 1)}
              rel="prev"
              className={`${linkClass} border-line text-ink hover:border-brand hover:text-brand`}
            >
              Previous
            </Link>
          ) : (
            <span className={`${linkClass} border-line text-ink-faint`} aria-disabled="true">
              Previous
            </span>
          )}
        </li>

        {pages.map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-ink-faint" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={buildHref(p)}
                aria-current={p === current ? "page" : undefined}
                className={
                  p === current
                    ? `${linkClass} border-brand bg-brand text-white`
                    : `${linkClass} border-line text-ink hover:border-brand hover:text-brand`
                }
              >
                {p}
              </Link>
            </li>
          ),
        )}

        <li>
          {current < totalPages ? (
            <Link
              href={buildHref(current + 1)}
              rel="next"
              className={`${linkClass} border-line text-ink hover:border-brand hover:text-brand`}
            >
              Next
            </Link>
          ) : (
            <span className={`${linkClass} border-line text-ink-faint`} aria-disabled="true">
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
