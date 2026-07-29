import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coming soon",
  robots: { index: false },
};

/**
 * Placeholder for features that arrive in Phases 2 and 3 (accounts, posting,
 * messaging, favourites). Linking here rather than to a dead URL keeps the
 * navigation honest: nothing 404s, and nothing pretends to work.
 */
export default function ComingSoonPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        This part isn&apos;t live yet
      </h1>
      <p className="mt-4 text-ink-muted">
        Accounts, posting an ad, messaging and saved listings are on their way.
        Right now you can browse and search every listing on GTASearch.
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
