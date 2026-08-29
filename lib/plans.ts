// GTASearch Pro — the single source of truth for what a subscription costs
// and what it changes. Imported by the upgrade page, Stripe checkout, the
// webhook and the browse ordering, so there is one place to change any of it.

export const PRO_PRICE_CENTS = 1900; // CAD $19.00 / month
export const PRO_CURRENCY = "cad";

/**
 * Photo allowances. Claiming is free and always includes enough photos to
 * represent the business honestly; Pro raises the ceiling rather than gating
 * the basics. Nothing about keeping a listing ACCURATE is ever paywalled —
 * a directory that charges for correctness is a worse directory.
 */
export const FREE_PHOTO_LIMIT = 3;
export const PRO_PHOTO_LIMIT = 10;

export function photoLimitFor(plan: string): number {
  return plan === "pro" ? PRO_PHOTO_LIMIT : FREE_PHOTO_LIMIT;
}

/**
 * Active-deal allowances. Same principle as photos: a claimed business can
 * always run a deal for free, because deals are how an owner reaches the
 * people already looking at their listing — and because an empty Deals page
 * helps nobody. Pro raises the ceiling rather than unlocking the feature.
 */
export const FREE_DEAL_LIMIT = 1;
export const PRO_DEAL_LIMIT = 5;

export function dealLimitFor(plan: string): number {
  return plan === "pro" ? PRO_DEAL_LIMIT : FREE_DEAL_LIMIT;
}

/** Longest a deal may run. Not a restriction so much as a freshness rule:
 *  the commonest complaint about directory sites is coupons that expired
 *  months ago, so an owner has to renew rather than set and forget. */
export const MAX_DEAL_DAYS = 90;

export function isPro(plan: string, renewsAt: Date | null, now: Date = new Date()): boolean {
  // A cancelled subscription keeps its benefits until the paid period ends;
  // the webhook clears `plan` when Stripe says the subscription is gone, and
  // this date check is the belt-and-braces for a webhook we never received.
  if (plan !== "pro") return false;
  if (renewsAt === null) return false;
  return renewsAt > now;
}

export const PRO_BENEFITS = [
  `Up to ${PRO_PHOTO_LIMIT} photos instead of ${FREE_PHOTO_LIMIT}`,
  "Priority placement in category and city results, labelled as promoted",
  `Up to ${PRO_DEAL_LIMIT} active deals instead of ${FREE_DEAL_LIMIT}`,
  "Support a local directory built on public records, not scraped data",
] as const;
