import Image from "next/image";
import Link from "next/link";
import { requireAdmin, adminSearchListings } from "@/lib/admin";
import { formatRelativeTime } from "@/lib/format";
import { RowActions } from "./RowActions";

const CHIP: Record<string, string> = {
  active: "bg-brand-50 text-brand",
  draft: "border border-line text-ink-muted",
  sold: "bg-surface-alt text-ink-muted",
  expired: "bg-amber-50 text-amber-700",
  deleted: "bg-red-50 text-red-700",
};

export default async function AdminListingsPage({
  searchParams,
}: { searchParams: { q?: string } }) {
  await requireAdmin();
  const q = searchParams.q ?? "";
  const rows = await adminSearchListings(q);

  return (
    <>
      <form action="/admin/listings" method="GET" className="flex gap-2">
        <input
          type="search" name="q" defaultValue={q}
          placeholder="Search by title or seller email…"
          className="h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand"
        />
        <button type="submit" className="h-11 rounded-btn bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
          Search
        </button>
      </form>

      <p className="mt-3 text-xs text-ink-faint">
        {rows.length} {rows.length === 1 ? "result" : "results"}
        {rows.length === 50 ? " (capped at 50 — narrow the search)" : ""} · all statuses included
      </p>

      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 p-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-btn bg-surface-alt">
              {r.images[0] && <Image src={r.images[0]} alt="" fill sizes="48px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/listing/${r.id}`} className="block truncate text-sm font-medium text-brand hover:underline">
                {r.title || "(untitled draft)"}
              </Link>
              <p className="truncate text-xs text-ink-muted">
                {r.seller.email} · {r.views} views · {formatRelativeTime(r.createdAt)} ·{" "}
                <span className="font-mono">{r.id}</span>
              </p>
            </div>
            <span className={`shrink-0 rounded-btn px-2 py-0.5 text-xs font-semibold ${CHIP[r.status] ?? ""}`}>
              {r.status}
            </span>
            <RowActions listingId={r.id} status={r.status} />
          </li>
        ))}
        {rows.length === 0 && <li className="p-6 text-center text-sm text-ink-muted">Nothing matched.</li>}
      </ul>
    </>
  );
}
