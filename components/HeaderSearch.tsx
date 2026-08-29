"use client";

import { usePathname } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { isClassifiedsPath } from "@/lib/header-nav";

// The homepage (directory hub) and /classifieds each open with their own
// large hero search; showing the header's compact one directly above it
// reads as a bug (user-reported). Hidden there, present everywhere else.
// usePathname resolves during SSR too, so there is no flash.
const HIDDEN_ON = new Set(["/", "/classifieds"]);

/**
 * Compact keyword-only business search for the header — shown on directory
 * browse pages and business profiles, where the listings search would point
 * users at the wrong index. Same GET-form approach as SearchBar: no JS, no
 * client state, submits straight to /directory/search.
 */
function CompactBusinessSearch() {
  return (
    <form
      action="/directory/search"
      method="GET"
      role="search"
      className="flex w-full items-stretch gap-2"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor="header-biz-q" className="sr-only">
          Search businesses
        </label>
        <input
          id="header-biz-q"
          type="search"
          name="q"
          placeholder="Search businesses…"
          className="h-10 w-full rounded-btn border border-line px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand"
        />
      </div>
      <button
        type="submit"
        className="h-10 rounded-btn bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        Search
      </button>
    </form>
  );
}

export function HeaderSearch({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  if (HIDDEN_ON.has(pathname)) return null;

  // Businesses unless you are actually in the classifieds. This was inverted
  // before — only /directory and /biz searched businesses — so the search box
  // on /near-me, /events and /about quietly searched the classifieds index and
  // returned nothing for real business queries.
  const search = isClassifiedsPath(pathname) ? (
    <SearchBar variant="compact" />
  ) : (
    <CompactBusinessSearch />
  );

  if (variant === "desktop") {
    return <div className="hidden flex-1 sm:block">{search}</div>;
  }
  // Mobile: just the search cell — the row wrapper (with the Classifieds
  // link) stays in the Header so navigation survives on the hidden pages.
  return <div className="min-w-0 flex-1">{search}</div>;
}
