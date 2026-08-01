// Shared, presentation-agnostic helpers for the directory browse pages
// (app/directory/[category]/page.tsx and app/directory/[category]/[city]/page.tsx).
// Plain module — no "use client" — safe to import from server components.

export const CHIP_BASE =
  "inline-block rounded-btn border px-3 py-1.5 text-xs font-medium";
export const CHIP_ACTIVE = `${CHIP_BASE} border-brand bg-brand text-white`;
export const CHIP_INACTIVE = `${CHIP_BASE} border-line bg-surface text-ink-muted hover:border-brand hover:text-brand`;

/** Clamps a raw `?page=` query value to a positive integer, defaulting to 1.
 *  Directory URLs are user-editable and must never throw on a bad value. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw ?? "1");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
