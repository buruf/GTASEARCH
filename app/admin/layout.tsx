import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// Tabs only — every page under /admin calls requireAdmin() itself, and every
// action re-checks. The layout renders no privileged data.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const tab = "rounded-btn px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-surface-alt hover:text-ink";
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <h1 className="mr-4 text-xl font-bold text-ink">Admin</h1>
        <Link href="/admin" className={tab}>Overview</Link>
        <Link href="/admin/reports" className={tab}>Reports</Link>
        <Link href="/admin/listings" className={tab}>Listings</Link>
        <Link href="/admin/claims" className={tab}>Claims</Link>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
