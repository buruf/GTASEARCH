// Display formatting. All currency is CAD.

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const CAD_WITH_CENTS = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type PriceType = "fixed" | "free" | "contact" | "trade";

/**
 * Anything a price can arrive as. Prisma's query builder returns Decimal
 * instances and $queryRaw returns them too, so this must not assume a
 * primitive — an earlier version checked `typeof price === "string"` and
 * silently rendered every real price as "Please contact".
 */
export type PriceInput =
  | string
  | number
  | { toString(): string }
  | null
  | undefined;

/**
 * Renders the price for display.
 *
 * Whole-dollar amounts drop the cents, since virtually every classified price
 * is round and "$850" reads better than "$850.00".
 */
export function formatPrice(price: PriceInput, priceType: string): string {
  if (priceType === "free") return "Free";
  if (priceType === "contact") return "Please contact";
  if (priceType === "trade") return "Trade";
  if (price === null || price === undefined) return "Please contact";

  // String() handles primitives and Decimal alike; Decimal.toString() yields a
  // plain numeric string.
  const n = typeof price === "number" ? price : Number(String(price));
  if (!Number.isFinite(n)) return "Please contact";

  return Number.isInteger(n) ? CAD.format(n) : CAD_WITH_CENTS.format(n);
}

/**
 * Relative time, e.g. "3 hours ago". Deliberately coarse — classifieds only
 * need a rough sense of freshness.
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

/** Absolute date for the listing detail page, e.g. "28 July 2026". */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** "Member since March 2026" */
export function formatMemberSince(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatCount(n: number, singular: string, plural?: string) {
  const word = n === 1 ? singular : (plural ?? `${singular}s`);
  return `${n.toLocaleString("en-CA")} ${word}`;
}
