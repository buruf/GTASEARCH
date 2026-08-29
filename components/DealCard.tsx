import Link from "next/link";
import { getCityLabel } from "@/lib/cities";
import { getBusinessCategoryLabel } from "@/lib/business-categories";
import { dealTimeLeft, type DealRow } from "@/lib/deals";

export function DealCard({ deal, now }: { deal: DealRow; now?: Date }) {
  const left = dealTimeLeft(deal.endsAt, now);

  return (
    <article className="h-full overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-line transition-shadow hover:shadow-card-hover">
      <Link href={`/biz/${deal.business.slug}`} className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="rounded-btn bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
            Deal
          </span>
          {left && (
            <span className="shrink-0 text-[11px] font-semibold text-brand-dark">{left}</span>
          )}
        </div>

        {/* h2, not h3: cards sit directly under the page h1 and an h1->h3 skip
            fails the heading-order audit (the BusinessCard lesson). */}
        <h2 className="mt-2 line-clamp-2 text-sm font-semibold text-ink">{deal.title}</h2>
        <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{deal.description}</p>

        {deal.code && (
          <p className="mt-2 text-xs text-ink-faint">
            Code <span className="font-mono font-semibold text-ink">{deal.code}</span>
          </p>
        )}

        <div className="mt-auto pt-3">
          <p className="truncate text-xs font-medium text-ink">{deal.business.name}</p>
          <p className="truncate text-[11px] text-ink-faint">
            {getBusinessCategoryLabel(deal.business.category)} ·{" "}
            {getCityLabel(deal.business.city)}
          </p>
        </div>
      </Link>
    </article>
  );
}

export function DealGrid({ deals, now }: { deals: DealRow[]; now?: Date }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {deals.map((d) => (
        <li key={d.id}>
          <DealCard deal={d} now={now} />
        </li>
      ))}
    </ul>
  );
}
