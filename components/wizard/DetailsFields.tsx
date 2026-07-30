// Shared by /post-ad/details and /listing/[id]/edit — one source of truth for
// the details form fields (spec §6).
export function DetailsFields({
  defaults, fieldErrors = {},
}: {
  defaults: { title: string; description: string; priceType: string; price: string };
  fieldErrors?: Record<string, string>;
}) {
  const input = "mt-1 h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
  const err = (k: string) => fieldErrors[k]
    ? <p role="alert" className="mt-1 text-sm text-red-600">{fieldErrors[k]}</p> : null;

  return (
    <>
      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="title">Title</label>
      <input id="title" name="title" required maxLength={80} defaultValue={defaults.title} className={input} />
      {err("title")}

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="description">Description</label>
      <textarea id="description" name="description" required minLength={20} maxLength={2000} rows={6}
        defaultValue={defaults.description} className="mt-1 w-full rounded-btn border border-line p-3 text-sm focus:border-brand" />
      {err("description")}

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-ink">Price</legend>
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          {(["fixed", "free", "contact", "trade"] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5">
              <input type="radio" name="priceType" value={t} defaultChecked={defaults.priceType === t} className="h-4 w-4 text-brand" />
              {{ fixed: "Amount (CAD)", free: "Free", contact: "Please contact", trade: "Trade" }[t]}
            </label>
          ))}
        </div>
        <input name="price" type="number" inputMode="decimal" min="0" max="9999999" step="0.01"
          placeholder="$ amount" defaultValue={defaults.price} className={`${input} max-w-48`} />
        {err("price")}
      </fieldset>
    </>
  );
}
