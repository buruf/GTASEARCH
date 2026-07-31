// Boost tiers — the single source of truth for the wizard step, the boost
// picker page, Stripe checkout line items, and the webhook. Prices are
// server-side only; clients ever submit a tier KEY.

export const BOOST_TIERS = {
  top: { label: "Top Ad", blurb: "Appears above standard listings in its category.", cents: 499, days: 7, level: "top" },
  featured: { label: "Featured", blurb: "Featured badge, highlighted border, top placement.", cents: 999, days: 14, level: "featured" },
  super: { label: "Super Boost", blurb: "Everything in Featured plus the homepage featured strip.", cents: 1499, days: 30, level: "super" },
} as const;

export type BoostTierKey = keyof typeof BOOST_TIERS;

export function isBoostTierKey(s: string): s is BoostTierKey {
  return Object.hasOwn(BOOST_TIERS, s);
}

/**
 * Effective boost rank: 0 super, 1 featured, 2 top, 3 none/lapsed.
 * MUST stay in lockstep with the EFFECTIVE_BOOST SQL CASE in lib/search.ts —
 * the SQL orders queries; this orders anything computed in TypeScript.
 * lib/boost.test.ts pins the shared truth table.
 */
export function effectiveBoostOf(
  level: string,
  expiresAt: Date | null,
  now: Date = new Date(),
): 0 | 1 | 2 | 3 {
  if (expiresAt === null || expiresAt <= now) return 3;
  if (level === "super") return 0;
  if (level === "featured") return 1;
  if (level === "top") return 2;
  return 3;
}
