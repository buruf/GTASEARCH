"use client";

import { useState } from "react";
import { CITIES, getCity } from "@/lib/cities";
import { FieldError } from "./FieldError";

// Client component so the neighbourhood suggestions track the selected city —
// a Brampton seller should never be offered "The Annex". The field itself
// stays free text: the datalist only suggests, and with JavaScript disabled
// the form still submits fine (suggestions just don't update).
export function LocationFields({
  defaults, fieldErrors = {},
}: {
  defaults: { city: string; neighbourhood: string; postalCode: string };
  fieldErrors?: Record<string, string>;
}) {
  const input = "mt-1 h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
  const [city, setCity] = useState(defaults.city);
  const neighbourhoods = getCity(city)?.neighbourhoods ?? [];

  return (
    <>
      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="city">City</label>
      <select
        id="city" name="city" required value={city}
        onChange={(e) => setCity(e.target.value)}
        className={`${input} bg-surface`}
      >
        <option value="" disabled>Choose a city…</option>
        {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      <FieldError message={fieldErrors["city"]} />

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="neighbourhood">Neighbourhood (optional)</label>
      <input id="neighbourhood" name="neighbourhood" list="hoods" maxLength={80}
        defaultValue={defaults.neighbourhood} className={input}
        placeholder={city ? undefined : "Choose a city first for suggestions"} />
      <datalist id="hoods">
        {neighbourhoods.map((n) => <option key={n} value={n} />)}
      </datalist>

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="postalCode">Postal code (optional)</label>
      <input id="postalCode" name="postalCode" maxLength={7} placeholder="M5V 2T6"
        defaultValue={defaults.postalCode} className={`${input} max-w-40`} />
      <p className="mt-1 text-xs text-ink-faint">Used for distance sorting later. Never shown publicly.</p>
      <FieldError message={fieldErrors["postalCode"]} />
    </>
  );
}
