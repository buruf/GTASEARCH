"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchDealsNearbyAction } from "@/app/deals/actions";
import { formatDistance } from "@/lib/near";
import { dealTimeLeft, type NearbyDeal } from "@/lib/deals";
import { getBusinessCategoryLabel } from "@/lib/business-categories";
import { getCityLabel } from "@/lib/cities";

const RADII = [1, 2, 5, 10, 25];

export function DealsNearMe() {
  const [rows, setRows] = useState<NearbyDeal[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);

  function run(
    at: { latitude: number; longitude: number },
    nextRadius = radiusKm,
    nextQuery = query,
  ) {
    startTransition(async () => {
      const res = await searchDealsNearbyAction({
        latitude: at.latitude,
        longitude: at.longitude,
        radiusKm: nextRadius,
        q: nextQuery.trim() || undefined,
      });
      if (res.error) {
        setError(res.error);
        setRows([]);
        setCount(0);
      } else {
        setError(null);
        setRows(res.rows ?? []);
        setCount(res.total ?? 0);
      }
    });
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("This browser cannot share your location. The full list is below.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const at = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setCoords(at);
        run(at);
      },
      (err) => {
        setLocating(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was declined. The full list of deals is below."
            : "Your location could not be determined. The full list of deals is below.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const busy = pending || locating;

  return (
    <section aria-labelledby="deals-near-heading" className="rounded-card border border-line bg-surface-alt p-5">
      <h2 id="deals-near-heading" className="text-base font-semibold text-ink">
        Deals near you
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Share your location to see current offers closest to you first.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={locate}
          disabled={busy}
          className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {locating ? "Finding you…" : coords ? "Update my location" : "Use my location"}
        </button>

        {coords && (
          <>
            <label htmlFor="deal-radius" className="ml-1 text-xs font-medium text-ink-muted">
              Within
            </label>
            <select
              id="deal-radius"
              value={radiusKm}
              disabled={busy}
              onChange={(e) => {
                const next = Number(e.target.value);
                setRadiusKm(next);
                run(coords, next);
              }}
              className="h-9 rounded-btn border border-line bg-surface px-2 text-sm text-ink"
            >
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Your location is used for this search only. It is never stored, never put
        in the page address, and never shared.
      </p>

      {coords && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(coords);
          }}
        >
          <label htmlFor="deal-q" className="sr-only">
            Search deals near you
          </label>
          <input
            id="deal-q"
            type="search"
            value={query}
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pizza, oil change, haircut…"
            className="h-10 min-w-0 flex-1 rounded-btn border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand"
          />
          <button
            type="submit"
            disabled={busy}
            className="h-10 shrink-0 rounded-btn bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            Search
          </button>
        </form>
      )}

      {error && (
        <p role="status" className="mt-3 rounded-card border border-line bg-surface p-3 text-sm text-ink">
          {error}
        </p>
      )}

      {pending && <p className="mt-4 text-sm text-ink-muted">Searching…</p>}

      {!pending && rows && rows.length === 0 && !error && (
        <p className="mt-4 text-sm text-ink-muted">
          No deals within {radiusKm} km yet. Deals are posted by the businesses
          themselves, so this fills up as local owners claim their listings.
        </p>
      )}

      {!pending && rows && rows.length > 0 && (
        <>
          <p className="mt-4 text-sm text-ink-muted">
            {count.toLocaleString("en-CA")} within {radiusKm} km, closest first
          </p>
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
            {rows.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/biz/${d.businessSlug}`}
                  className="flex items-start gap-3 p-4 hover:bg-brand-50"
                >
                  <span className="mt-0.5 shrink-0 rounded-btn bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-dark">
                    {formatDistance(d.distanceKm)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{d.title}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {d.businessName} · {getBusinessCategoryLabel(d.category)} ·{" "}
                      {getCityLabel(d.city)}
                    </span>
                    {/* Always show when it ends — an offer without an end date
                        is how people arrive holding an expired coupon. */}
                    <span className="block text-[11px] text-ink-faint">
                      Ends {d.endsAt.toLocaleDateString("en-CA")}
                      {dealTimeLeft(d.endsAt) ? ` · ${dealTimeLeft(d.endsAt)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
