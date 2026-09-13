import Image from "next/image";
import Link from "next/link";
import { requireAdmin, adminSearchListings, ADMIN_LISTING_STATUSES } from "@/lib/admin";
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
}: { searchParams: { q?: string; status?: string } }) {
  await requireAdmin();
  const q = searchParams.q ?? "";
  const status = (ADMIN_LISTING_STATUSES as readonly string[]).includes(searchParams.status ?? "")
    ? searchParams.status
    : undefined;
  const rows = await adminSearchListings(q, status);

  const chipHref = (s?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("status", s);
    const qs = p.toString();
    return qs ? `/admin/listings?${qs}` : "/admin/listings";
  };
  const chipClass = (on: boolean) =>
    `inline-block rounded-btn border px-3 py-1.5 text-xs font-medium ${
      on
        ? "border-brand bg-brand text-white"
        : "border-line bg-surface text-ink-muted hover:border-brand hover:text-brand"
    }`;

  return (
    <>
      <form action="/admin/listings" method="GET" className="flex gap-2">
        <input
          type="search" name="q" defaultValue={q}
          placeholder="Search by title or seller email…"
          className="h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand"
        />
        {/* Carried through the search box, so filtering and then searching does
            not silently drop the status the admin arrived with. */}
        {status && <input type="hidden" name="status" value={status} />}
        <button type="submit" className="h-11 rounded-btn bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
          Search
        </button>
      </form>

      {/* The overview's Drafts / Sold / Expired tiles link straight into these.
          That is why the filter exists: a count you cannot open is a dead end,
          which is exactly what the owner reported. */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={chipHref()} className={chipClass(!status)}>All</Link>
        {ADMIN_LISTING_STATUSES.map((s) => (
          <Link key={s} href={chipHref(s)} className={chipClass(status === s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        {rows.length} {rows.length === 1 ? "result" : "results"}
        {rows.length === 50 ? " (capped at 50 — narrow the search)" : ""}
        {status ? ` · ${status} only` : " · all statuses included"}
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
