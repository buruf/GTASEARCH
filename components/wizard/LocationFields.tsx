import { CITIES } from "@/lib/cities";

export function LocationFields({
  defaults, fieldErrors = {},
}: {
  defaults: { city: string; neighbourhood: string; postalCode: string };
  fieldErrors?: Record<string, string>;
}) {
  const input = "mt-1 h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
  const err = (k: string) => fieldErrors[k]
    ? <p role="alert" className="mt-1 text-sm text-red-600">{fieldErrors[k]}</p> : null;
  const neighbourhoods = CITIES.flatMap((c) => c.neighbourhoods);

  return (
    <>
      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="city">City</label>
      <select id="city" name="city" required defaultValue={defaults.city} className={`${input} bg-surface`}>
        <option value="" disabled>Choose a city…</option>
        {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      {err("city")}

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="neighbourhood">Neighbourhood (optional)</label>
      <input id="neighbourhood" name="neighbourhood" list="hoods" maxLength={80}
        defaultValue={defaults.neighbourhood} className={input} />
      <datalist id="hoods">
        {neighbourhoods.map((n) => <option key={n} value={n} />)}
      </datalist>

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="postalCode">Postal code (optional)</label>
      <input id="postalCode" name="postalCode" maxLength={7} placeholder="M5V 2T6"
        defaultValue={defaults.postalCode} className={`${input} max-w-40`} />
      <p className="mt-1 text-xs text-ink-faint">Used for distance sorting later. Never shown publicly.</p>
      {err("postalCode")}
    </>
  );
}
