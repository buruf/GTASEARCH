"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { BOOST_TIERS } from "@/lib/boost";
import { SubmitButton } from "@/components/wizard/SubmitButton";
import { publishWithBoostAction } from "../actions";
import type { FormState } from "@/app/auth/actions";

export function BoostStepForm() {
  const [state, formAction] = useFormState<FormState, FormData>(publishWithBoostAction, { ok: false });

  return (
    <div className="mt-4 space-y-3">
      <Link
        href="/post-ad/review"
        className="flex cursor-pointer items-center gap-3 rounded-card border-2 border-brand bg-brand-50 p-4"
      >
        <div>
          <p className="text-sm font-semibold text-ink">Free listing — continue to review</p>
          <p className="text-xs text-ink-muted">Standard placement, 30 days.</p>
        </div>
      </Link>

      <form action={formAction} className="space-y-3">
        {Object.entries(BOOST_TIERS).map(([key, t]) => (
          <label key={key} className="relative block cursor-pointer">
            <input type="radio" name="tier" value={key} className="peer sr-only" />
            <div className="flex items-center gap-3 rounded-card border border-line p-4 peer-checked:border-brand peer-checked:ring-2 peer-checked:ring-brand">
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">
                  {t.label} — ${(t.cents / 100).toFixed(2)} / {t.days} days
                </p>
                <p className="text-xs text-ink-muted">{t.blurb}</p>
              </div>
            </div>
          </label>
        ))}

        <p className="text-xs text-ink-faint">
          Your ad publishes immediately; payment opens in Stripe&apos;s secure checkout.
        </p>

        {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton>Publish &amp; pay</SubmitButton>
      </form>
    </div>
  );
}
