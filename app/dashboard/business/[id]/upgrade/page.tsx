import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { ClaimError, ownedBusiness } from "@/lib/claims";
import { stripeEnabled } from "@/lib/env";
import { PRO_BENEFITS, PRO_PRICE_CENTS, isPro } from "@/lib/plans";
import { startProCheckout } from "./actions";

export const metadata: Metadata = {
  title: "Upgrade to Pro",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { cancelled?: string };
}) {
  const userId = await currentUserId();
  if (!userId) {
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/dashboard/business/${params.id}/upgrade`)}`,
    );
  }

  let business;
  try {
    business = await ownedBusiness(userId, params.id);
  } catch (err) {
    if (err instanceof ClaimError) notFound();
    throw err;
  }

  const pro = isPro(business.plan, business.planRenewsAt);
  const price = (PRO_PRICE_CENTS / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href={`/dashboard/business/${business.id}`} className="hover:text-brand">
          ← Back to {business.name}
        </Link>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">GTASearch Pro</h1>
      <p className="mt-2 text-sm text-ink-muted">
        ${price} CAD per month for {business.name}. Cancel any time.
      </p>

      {searchParams.cancelled === "1" && (
        <p className="mt-4 rounded-btn bg-surface-alt px-3 py-2 text-sm text-ink-muted">
          Checkout cancelled — nothing was charged.
        </p>
      )}

      {pro ? (
        <p className="mt-6 rounded-card border border-line bg-brand-50 p-4 text-sm text-ink">
          This business is already on Pro
          {business.planRenewsAt
            ? `, renewing ${business.planRenewsAt.toLocaleDateString("en-CA")}`
            : ""}
          .
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-2">
            {PRO_BENEFITS.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-ink">
                <span aria-hidden="true" className="text-brand">
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-card border border-line bg-surface-alt p-4 text-sm text-ink-muted">
            <p className="font-medium text-ink">What Pro does not do</p>
            <p className="mt-1">
              It does not change your reviews, ratings or the facts on your
              listing, and it does not hide competitors. Promoted placement is
              labelled wherever it appears, so visitors can always tell. Keeping
              your listing accurate is free and always will be.
            </p>
          </div>

          {stripeEnabled() ? (
            <form action={startProCheckout} className="mt-6">
              <input type="hidden" name="businessId" value={business.id} />
              <button
                type="submit"
                className="rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Continue to payment
              </button>
              <p className="mt-2 text-xs text-ink-faint">
                Payment is handled by Stripe. We never see your card details.
              </p>
            </form>
          ) : (
            <p className="mt-6 rounded-card border border-line bg-surface-alt p-4 text-sm text-ink-muted">
              Paid plans are not switched on yet. Nothing about your listing
              changes, and claiming stays free.
            </p>
          )}
        </>
      )}
    </div>
  );
}
