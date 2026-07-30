"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const first = name.split(" ")[0];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="rounded-btn px-3 py-2 text-sm font-medium text-ink hover:bg-surface-alt">
        {first} ▾
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-card border border-line bg-surface py-1 shadow-card-hover">
          <Link href="/dashboard" className="block px-4 py-2 text-sm text-ink hover:bg-surface-alt" onClick={() => setOpen(false)}>Dashboard</Link>
          <button type="button" onClick={() => signOut({ callbackUrl: "/" })}
            className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-alt">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
