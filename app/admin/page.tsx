import Link from "next/link";
import { requireAdmin, adminStats } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatRelativeTime } from "@/lib/format";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const s = await adminStats();
  const recent = await db.listing.findMany({
    orderBy: { createdAt: "desc" }, take: 5,
    select: { id: true, title: true, status: true, createdAt: true },
  });

  const cards: [string, string | number][] = [
    ["Users", s.users],
    ["Active listings", s.activeListings],
    ["Open reports", s.openReports],
    ["Boost revenue", `$${s.boostRevenue.toFixed(2)}`],
    ["Drafts", s.drafts],
    ["Sold", s.sold],
    ["Expired", s.expired],
    ["Unread messages", s.unreadMessages],
  ];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(([label, value]) => (
          <li key={label} className="rounded-card border border-line bg-surface p-4">
            <p className="text-2xl font-bold text-ink">{value}</p>
            <p className="mt-1 text-xs text-ink-muted">{label}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-base font-bold text-ink">Newest listings</h2>
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {recent.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <Link href={`/listing/${l.id}`} className="truncate font-medium text-brand hover:underline">
              {l.title || "(untitled draft)"}
            </Link>
            <span className="shrink-0 text-xs text-ink-muted">{l.status} · {formatRelativeTime(l.createdAt)}</span>
          </li>
        ))}
        {recent.length === 0 && <li className="p-3 text-sm text-ink-muted">No listings yet.</li>}
      </ul>
    </>
  );
}
