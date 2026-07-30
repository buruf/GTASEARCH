import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { savedListingsFor } from "@/lib/saved";
import { ListingCard } from "@/components/ListingCard";

export const metadata: Metadata = { title: "Saved listings", robots: { index: false } };

const BADGE: Record<string, { label: string; cls: string }> = {
  sold: { label: "Sold", cls: "bg-surface-alt text-ink-muted" },
  expired: { label: "Expired", cls: "bg-amber-50 text-amber-700" },
  removed: { label: "Removed", cls: "bg-surface-alt text-ink-faint" },
};

export default async function SavedPage() {
  const userId = await requireUserId();
  const rows = await savedListingsFor(userId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Saved listings</h1>
      {rows.length === 0 ? (
        <div className="mt-8 rounded-card border border-line bg-surface-alt px-6 py-12 text-center">
          <p className="font-semibold text-ink">Nothing saved yet</p>
          <p className="mt-2 text-sm text-ink-muted">Tap the heart on any listing to keep it here.</p>
          <Link href="/search" className="mt-4 inline-block rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
            Browse listings
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.id} className="relative">
              {r.displayStatus !== "active" && (
                <span className={`absolute left-2 top-2 z-10 rounded-btn px-2 py-0.5 text-xs font-semibold ${BADGE[r.displayStatus].cls}`}>
                  {BADGE[r.displayStatus].label}
                </span>
              )}
              <ListingCard listing={r} saved={true} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
