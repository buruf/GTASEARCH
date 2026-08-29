"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { searchNearbyAction } from "@/app/near-me/actions";
import { BUSINESS_CATEGORIES, getBusinessCategoryLabel } from "@/lib/business-categories";
import { formatDistance, type NearbyBusiness } from "@/lib/near";
import { getCityLabel } from "@/lib/cities";

const RADII = [1, 2, 5, 10, 25];

export function NearMe({ located, total }: { located: number; total: number }) {
  const [rows, setRows] = useState<NearbyBusiness[] | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);

  function run(
    at: { latitude: number; longitude: number },
    nextRadius = radiusKm,
    nextCategory = category,
    nextQuery = query,
  ) {
    startTransition(async () => {
      const res = await searchNearbyAction({
        latitude: at.latitude,
        longitude: at.longitude,
        radiusKm: nextRadius,
        category: nextCategory || undefined,
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
      setError("This browser cannot share your location. Try browsing by city instead.");
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
        // Each case gets its own wording — "something went wrong" tells a
        // person nothing about whether to retry or change a setting.
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was declined. You can still browse by city below."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Your location could not be determined. Try again, or browse by city."
              : "Finding your location took too long. Try again, or browse by city.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const busy = pending || locating;

  return (
    <div>
      <div className="rounded-card border border-line bg-surface-alt p-5">
        <button
          type="button"
          onClick={locate}
          disabled={busy}
          className="rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {locating ? "Finding you…" : coords ? "Update my location" : "Use my location"}
        </button>
        <p className="mt-2 text-xs text-ink-muted">
          Your location is used for this search only. It is never stored, never
          put in the page address, and never shared.
        </p>

        {coords && (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(coords);
            }}
          >
            <label htmlFor="near-q" className="sr-only">
              Search for a business near you
            </label>
            <input
              id="near-q"
              type="search"
              value={query}
              disabled={busy}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Shoppers Drug Mart, halal food, dentist…"
              className="h-10 min-w-0 flex-1 rounded-btn border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-10 shrink-0 rounded-btn bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
            >
              Search
            </button>
            {query && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setQuery("");
                  run(coords, radiusKm, category, "");
                }}
                className="h-10 shrink-0 rounded-btn border border-line px-3 text-sm font-medium text-ink-muted hover:text-ink"
              >
                Clear
              </button>
            )}
          </form>
        )}

        {coords && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor="near-radius" className="text-xs font-medium text-ink-muted">
              Within
            </label>
            <select
              id="near-radius"
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

            <label htmlFor="near-category" className="ml-2 text-xs font-medium text-ink-muted">
              Category
            </label>
            <select
              id="near-category"
              value={category}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value;
                setCategory(next);
                run(coords, radiusKm, next);
              }}
              className="h-9 rounded-btn border border-line bg-surface px-2 text-sm text-ink"
            >
              <option value="">All categories</option>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <p role="status" className="mt-4 rounded-card border border-line bg-surface p-4 text-sm text-ink">
          {error}
        </p>
      )}

      {pending && <p className="mt-6 text-sm text-ink-muted">Searching…</p>}

      {!pending && rows && rows.length === 0 && !error && (
        <p className="mt-6 text-sm text-ink-muted">
          No {query ? <strong className="font-semibold text-ink">{query}</strong> : "businesses"}{" "}
          within {radiusKm} km
          {category ? ` in ${getBusinessCategoryLabel(category)}` : ""}. Try a
          wider radius{query ? ", or a different spelling" : ""}.
        </p>
      )}

      {!pending && rows && rows.length > 0 && (
        <>
          <p className="mt-6 text-sm text-ink-muted">
            {count.toLocaleString("en-CA")}{" "}
            {query ? <>matching &ldquo;{query}&rdquo;</> : "businesses"} within{" "}
            {radiusKm} km, closest first
          </p>
          <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
            {rows.map((b) => (
              <li key={b.id}>
                <Link href={`/biz/${b.slug}`} className="flex items-start gap-3 p-4 hover:bg-brand-50">
                  <span className="mt-0.5 shrink-0 rounded-btn bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-dark">
                    {formatDistance(b.distanceKm)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{b.name}</span>
                    <span className="block truncate text-xs text-ink-muted">
                      {getBusinessCategoryLabel(b.category)} · {b.address}, {getCityLabel(b.city)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Stated up front rather than after a disappointing search: a third of
          the directory has no coordinates, and pretending otherwise would make
          the results look like the whole picture. */}
      <p className="mt-6 text-xs text-ink-faint">
        Distance search covers the {located.toLocaleString("en-CA")} of{" "}
        {total.toLocaleString("en-CA")} businesses whose source publishes a
        location. The rest are findable by name or city, but not by distance.
      </p>
    </div>
  );
}
