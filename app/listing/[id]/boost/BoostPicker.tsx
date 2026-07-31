"use client";

import { useFormState } from "react-dom";
import { BOOST_TIERS } from "@/lib/boost";
import { SubmitButton } from "@/components/wizard/SubmitButton";
import { startBoostCheckoutAction } from "./actions";
import type { FormState } from "@/app/auth/actions";

export function BoostPicker({ listingId }: { listingId: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(startBoostCheckoutAction, { ok: false });

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <input type="hidden" name="listingId" value={listingId} />

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

      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton>Continue to payment</SubmitButton>
    </form>
  );
}
