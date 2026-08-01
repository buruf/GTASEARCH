import Image from "next/image";
import Link from "next/link";
import { requireAdmin, openReportsByListing } from "@/lib/admin";
import { REPORT_REASONS } from "@/lib/validation";
import { formatRelativeTime } from "@/lib/format";
import { getCityLabel } from "@/lib/cities";
import { QueueActions } from "./QueueActions";

export default async function AdminReportsPage() {
  await requireAdmin();
  const groups = await openReportsByListing();

  if (groups.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface-alt px-6 py-12 text-center">
        <p className="font-semibold text-ink">No open reports</p>
        <p className="mt-1 text-sm text-ink-muted">Nothing needs you.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {groups.map((g) => (
        <li key={g.listing.id} className="rounded-card border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-btn bg-surface-alt">
              {g.listing.images[0] && (
                <Image src={g.listing.images[0]} alt="" fill sizes="64px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/listing/${g.listing.id}`} className="font-semibold text-brand hover:underline">
                {g.listing.title}
              </Link>
              <p className="text-xs text-ink-muted">
                {getCityLabel(g.listing.city)} · status: {g.listing.status} · seller:{" "}
                {g.listing.seller.name} ({g.listing.seller.email})
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
              {g.reports.length} {g.reports.length === 1 ? "report" : "reports"}
            </span>
          </div>

          <ul className="mt-3 space-y-2 border-t border-line pt-3">
            {g.reports.map((r) => (
              <li key={r.id} className="text-sm">
                <span className="font-medium text-ink">{REPORT_REASONS[r.reason] ?? r.reason}</span>
                <span className="text-ink-muted">
                  {" — "}{r.reporterName ?? "Anonymous"} · {formatRelativeTime(r.createdAt)}
                </span>
                {r.details && <p className="mt-0.5 text-ink-muted">&ldquo;{r.details}&rdquo;</p>}
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-line pt-3">
            <QueueActions listingId={g.listing.id} listingStatus={g.listing.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
