"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sectionLinkFor } from "@/lib/header-nav";

/** Header link to the other half of the site — see lib/header-nav.ts. */
export function HeaderSectionLink({ variant }: { variant: "desktop" | "mobile" }) {
  const { href, label } = sectionLinkFor(usePathname());

  return (
    <Link
      href={href}
      className={
        variant === "desktop"
          ? "hidden rounded-btn px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink sm:block"
          : "shrink-0 rounded-btn px-2 py-2 text-xs font-medium text-ink-muted hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}
