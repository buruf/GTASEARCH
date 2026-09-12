"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { formatUnreadCount } from "@/lib/format";

/**
 * `isAdmin` is decided on the server (Header) and passed in, never derived
 * here: this is a client component, so any rule it applied would ship to every
 * visitor and advertise what makes someone an admin.
 *
 * The link exists because the admin console had NO entry point anywhere outside
 * itself — the tab bar lives in app/admin/layout.tsx, which only renders once
 * you are already inside /admin. Reviewing the first claim GTASearch ever
 * received meant signing in correctly, landing on the ordinary dashboard, and
 * reasonably concluding the admin access had failed.
 */
export function UserMenu({
  name,
  unread,
  isAdmin = false,
}: {
  name: string;
  unread: number;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const first = name.split(" ")[0];
  const badgeText = formatUnreadCount(unread);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="rounded-btn px-3 py-2 text-sm font-medium text-ink hover:bg-surface-alt">
        {first} ▾
        {badgeText && (
          <span className="ml-1 rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">{badgeText}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-card border border-line bg-surface py-1 shadow-card-hover">
          <Link href="/messages" className="flex items-center justify-between px-4 py-2 text-sm text-ink hover:bg-surface-alt" onClick={() => setOpen(false)}>
            Messages
            {badgeText && (
              <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white">{badgeText}</span>
            )}
          </Link>
          <Link href="/dashboard" className="block px-4 py-2 text-sm text-ink hover:bg-surface-alt" onClick={() => setOpen(false)}>Dashboard</Link>
          <Link href="/dashboard/business" className="block px-4 py-2 text-sm text-ink hover:bg-surface-alt" onClick={() => setOpen(false)}>My businesses</Link>
          {isAdmin && (
            <Link
              href="/admin"
              className="block border-t border-line px-4 py-2 text-sm font-semibold text-brand hover:bg-surface-alt"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          )}
          <button type="button" onClick={() => signOut({ callbackUrl: "/" })}
            className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-alt">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
