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

  // A count with somewhere to go now carries its destination. The owner
  // reported clicking these and nothing happening, which is fair: a number
  // beside a label in a console is the one thing you always expect to open.
  //
  // A tile with no page stays inert rather than pointing somewhere
  // approximate. Sending "Pro subscribers" to a list that is not the Pro
  // subscribers would be worse than a number that plainly does not move.
  const cards: { label: string; value: string | number; href?: string }[] = [
    { label: "Users", value: s.users, href: "/admin/users" },
    { label: "Active listings", value: s.activeListings, href: "/admin/listings?status=active" },
    { label: "Open reports", value: s.openReports, href: "/admin/reports" },
    { label: "Boost revenue", value: `$${s.boostRevenue.toFixed(2)}` },
    { label: "Drafts", value: s.drafts, href: "/admin/listings?status=draft" },
    { label: "Sold", value: s.sold, href: "/admin/listings?status=sold" },
    { label: "Expired", value: s.expired, href: "/admin/listings?status=expired" },
    // Site-wide unread, not the admin's own inbox, so /messages would land
    // somewhere that does not explain this number.
    { label: "Unread messages", value: s.unreadMessages },
    { label: "Pending claims", value: s.pendingClaims, href: "/admin/claims" },
    { label: "Claimed businesses", value: s.claimedBusinesses },
    { label: "Pro subscribers", value: s.proBusinesses },
  ];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ label, value, href }) => {
          const inner = (
            <>
              <p className="text-2xl font-bold text-ink">{value}</p>
              <p className="mt-1 text-xs text-ink-muted">{label}</p>
            </>
          );
          return (
            <li key={label} className="rounded-card border border-line bg-surface">
              {href ? (
                <Link
                  href={href}
                  className="block rounded-card p-4 transition-colors hover:bg-brand-50"
                >
                  {inner}
                </Link>
              ) : (
                <div className="p-4">{inner}</div>
              )}
            </li>
          );
        })}
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
