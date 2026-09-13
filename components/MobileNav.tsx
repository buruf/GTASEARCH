"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { formatUnreadCount } from "@/lib/format";
import { sectionLinkFor } from "@/lib/header-nav";

/**
 * The header's navigation on a phone.
 *
 * Every link in the desktop header carried `hidden sm:block`, and nothing
 * replaced them below that breakpoint. On a phone the header was the logo,
 * "Post Ad" and a section link — Near me, Deals and Events were unreachable,
 * and so, critically, was SIGN IN: a signed-out visitor on a phone had no way
 * into their account from any page on the site.
 *
 * Reported by the owner testing on their own phone. More than half of local
 * directory traffic is mobile, so this was the majority experience.
 *
 * `isAdmin` and the signed-in state are decided on the server and passed in,
 * never derived here — this component ships to every visitor, so any rule it
 * applied would advertise what makes someone an admin. Same reasoning as
 * UserMenu.
 */
export function MobileNav({
  signedIn,
  name,
  unread,
  isAdmin = false,
}: {
  signedIn: boolean;
  name?: string;
  unread: number;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Read here rather than passed in: the Businesses/Classifieds link depends on
  // which section you are in, and this component is already a client one.
  const { href: sectionHref, label: sectionLabel } = sectionLinkFor(usePathname());
  const badgeText = formatUnreadCount(unread);
  const close = () => setOpen(false);

  const item =
    "block rounded-btn px-3 py-2.5 text-base font-medium text-ink hover:bg-surface-alt";

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="relative rounded-btn px-2.5 py-2 text-ink hover:bg-surface-alt"
      >
        {/* Drawn rather than an icon font or an SVG import: three bars is not
            worth a dependency, and inline strokes inherit the text colour. */}
        <span className="block h-0.5 w-5 bg-current" />
        <span className="mt-1 block h-0.5 w-5 bg-current" />
        <span className="mt-1 block h-0.5 w-5 bg-current" />
        {badgeText && (
          // An unread count has to be visible while the menu is CLOSED, or a
          // waiting message is invisible on a phone until you go looking.
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Tapping anywhere else closes it — on a phone there is no Escape
              key and no elsewhere to click without this. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
          />
          <nav
            aria-label="Main"
            className="absolute left-0 right-0 z-50 border-b border-line bg-surface p-3 shadow-card-hover"
          >
            <Link href="/near-me" className={item} onClick={close}>Near me</Link>
            <Link href="/deals" className={item} onClick={close}>Deals</Link>
            <Link href="/events" className={item} onClick={close}>Events</Link>
            <Link href={sectionHref} className={item} onClick={close}>{sectionLabel}</Link>

            <div className="my-2 border-t border-line" />

            {signedIn ? (
              <>
                <Link href="/messages" className={`${item} flex items-center justify-between`} onClick={close}>
                  Messages
                  {badgeText && (
                    <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {badgeText}
                    </span>
                  )}
                </Link>
                <Link href="/dashboard" className={item} onClick={close}>Dashboard</Link>
                <Link href="/saved" className={item} onClick={close}>Saved</Link>
                <Link href="/dashboard/business" className={item} onClick={close}>My businesses</Link>
                {isAdmin && (
                  <Link href="/admin" className={`${item} font-semibold text-brand`} onClick={close}>
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={`${item} w-full text-left`}
                >
                  Sign out{name ? ` (${name.split(" ")[0]})` : ""}
                </button>
              </>
            ) : (
              <Link href="/auth/signin" className={`${item} font-semibold text-brand`} onClick={close}>
                Sign in
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
