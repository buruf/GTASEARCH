import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-4 text-ink-muted">
        The listing may have been sold, removed, or expired. Listings are taken
        down automatically after 30 days.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Back to home
        </Link>
        <Link
          href="/search"
          className="rounded-btn border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand"
        >
          Browse all listings
        </Link>
      </div>
    </div>
  );
}
