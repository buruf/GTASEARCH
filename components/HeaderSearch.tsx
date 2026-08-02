"use client";

import { usePathname } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";

// The homepage and the directory hub each open with their own large search
// bar; showing the header's compact one directly above it reads as a bug
// (user-reported). Hidden there, present everywhere else. usePathname
// resolves during SSR too, so there is no flash.
const HIDDEN_ON = new Set(["/", "/directory"]);

export function HeaderSearch({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  if (HIDDEN_ON.has(pathname)) return null;

  if (variant === "desktop") {
    return (
      <div className="hidden flex-1 sm:block">
        <SearchBar variant="compact" />
      </div>
    );
  }
  // Mobile: just the search cell — the row wrapper (with the Directory link)
  // stays in the Header so navigation survives on the hidden pages.
  return (
    <div className="min-w-0 flex-1">
      <SearchBar variant="compact" />
    </div>
  );
}
