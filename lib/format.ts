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
 * Renders the price for display. Prices arrive from Prisma as Decimal, which
 * serialises to string — never coerce with Number() without care, but listing
 * prices are well within safe integer range so it is fine here.
 *
 * Whole-dollar amounts drop the cents, since virtually every classified price
 * is round and "$850" reads better than "$850.00".
 */
export function formatPrice(
  price: string | number | null | undefined,
  priceType: string,
): string {
  if (priceType === "free") return "Free";
  if (priceType === "contact") return "Please contact";
  if (priceType === "trade") return "Trade";
  if (price === null || price === undefined) return "Please contact";

  const n = typeof price === "string" ? parseFloat(price) : price;
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
