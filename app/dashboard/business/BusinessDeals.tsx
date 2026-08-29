"use client";

import { useActionState } from "react";
import { createDealAction, endDealAction, type DealState } from "./deals-actions";
import { dealTimeLeft } from "@/lib/deals";
import { MAX_DEAL_DAYS } from "@/lib/plans";

interface OwnerDeal {
  id: string;
  title: string;
  description: string;
  code: string | null;
  startsAt: Date;
  endsAt: Date;
  status: string;
}

export function BusinessDeals({
  businessId,
  deals,
  limit,
  isPro,
}: {
  businessId: string;
  deals: OwnerDeal[];
  limit: number;
  isPro: boolean;
}) {
  const [createState, createAction, creating] = useActionState<DealState | undefined, FormData>(
    createDealAction,
    undefined,
  );
  const [endState, endAction] = useActionState<DealState | undefined, FormData>(
    endDealAction,
    undefined,
  );

  const now = new Date();
  const live = deals.filter((d) => d.status === "published" && d.endsAt > now);
  const past = deals.filter((d) => !(d.status === "published" && d.endsAt > now));
  const atLimit = live.length >= limit;

  // Default the date input a month out, and cap it at the freshness limit.
  const maxDate = new Date(now.getTime() + MAX_DEAL_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const minDate = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

  return (
    <section aria-labelledby="deals-heading" className="mt-10">
      <h2 id="deals-heading" className="text-lg font-semibold text-ink">
        Deals &amp; offers
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Shown on your listing and on the GTASearch deals page. You can run{" "}
        {limit === 1 ? "one deal" : `${limit} deals`} at a time
        {isPro ? "" : " on the free plan"}.
      </p>

      {(createState?.ok || endState?.ok) && (
        <p role="status" className="mt-3 rounded-card bg-brand-50 p-3 text-sm text-brand-dark">
          {createState?.ok ?? endState?.ok}
        </p>
      )}
      {(createState?.error || endState?.error) && (
        <p role="alert" className="mt-3 rounded-card border border-line bg-surface p-3 text-sm text-ink">
          {createState?.error ?? endState?.error}
        </p>
      )}

      {live.length > 0 && (
        <ul className="mt-4 space-y-3">
          {live.map((d) => (
            <li key={d.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{d.title}</p>
                  <p className="mt-1 text-sm text-ink-muted">{d.description}</p>
                  {d.code && (
                    <p className="mt-1 text-xs text-ink-faint">
                      Code: <span className="font-mono font-semibold text-ink">{d.code}</span>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-faint">
                    Ends {d.endsAt.toLocaleDateString("en-CA")}
                    {dealTimeLeft(d.endsAt, now) ? ` · ${dealTimeLeft(d.endsAt, now)}` : ""}
                  </p>
                </div>
                <form action={endAction} className="shrink-0">
                  <input type="hidden" name="dealId" value={d.id} />
                  <input type="hidden" name="businessId" value={businessId} />
                  <button
                    type="submit"
                    className="rounded-btn border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                  >
                    End now
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="mt-4 rounded-card border border-line bg-surface-alt p-4 text-sm text-ink-muted">
          {limit === 1
            ? "You have a deal running. End it to start another, or upgrade to Pro to run more at once."
            : `You are running the maximum of ${limit} deals.`}
        </p>
      ) : (
        <form action={createAction} className="mt-4 space-y-3 rounded-card border border-line bg-surface-alt p-4">
          <input type="hidden" name="businessId" value={businessId} />

          <div>
            <label htmlFor="deal-title" className="block text-sm font-medium text-ink">
              Offer
            </label>
            <input
              id="deal-title"
              name="title"
              required
              maxLength={80}
              placeholder="15% off all haircuts"
              className="mt-1 h-10 w-full rounded-btn border border-line px-3 text-sm text-ink"
            />
            {createState?.fieldErrors?.title && (
              <p className="mt-1 text-xs text-red-700">{createState.fieldErrors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="deal-description" className="block text-sm font-medium text-ink">
              Details and conditions
            </label>
            <textarea
              id="deal-description"
              name="description"
              required
              rows={3}
              maxLength={600}
              placeholder="Valid Monday to Thursday. Not combined with other offers."
              className="mt-1 w-full rounded-btn border border-line px-3 py-2 text-sm text-ink"
            />
            {createState?.fieldErrors?.description && (
              <p className="mt-1 text-xs text-red-700">{createState.fieldErrors.description}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="deal-code" className="block text-sm font-medium text-ink">
                Code <span className="font-normal text-ink-faint">(optional)</span>
              </label>
              <input
                id="deal-code"
                name="code"
                maxLength={40}
                placeholder="SPRING15"
                className="mt-1 h-10 w-full rounded-btn border border-line px-3 text-sm text-ink"
              />
            </div>
            <div>
              <label htmlFor="deal-ends" className="block text-sm font-medium text-ink">
                Ends
              </label>
              <input
                id="deal-ends"
                name="endsAt"
                type="date"
                required
                min={minDate}
                max={maxDate}
                className="mt-1 h-10 rounded-btn border border-line px-3 text-sm text-ink"
              />
              {createState?.fieldErrors?.endsAt && (
                <p className="mt-1 text-xs text-red-700">{createState.fieldErrors.endsAt}</p>
              )}
            </div>
          </div>

          <p className="text-xs text-ink-faint">
            Deals run for up to {MAX_DEAL_DAYS} days so nobody arrives holding an
            expired coupon. You can renew when it ends.
          </p>

          <button
            type="submit"
            disabled={creating}
            className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {creating ? "Publishing…" : "Publish deal"}
          </button>
        </form>
      )}

      {past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-ink-muted">
            Past deals ({past.length})
          </summary>
          <ul className="mt-2 space-y-1 text-sm text-ink-faint">
            {past.map((d) => (
              <li key={d.id}>
                {d.title} — ended {d.endsAt.toLocaleDateString("en-CA")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
