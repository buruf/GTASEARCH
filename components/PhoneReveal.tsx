"use client";

import { useFormState, useFormStatus } from "react-dom";
import { revealPhoneAction, type PhoneState } from "@/app/listing/[id]/phone-actions";

function RevealButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="w-full rounded-btn border border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand-50 disabled:opacity-60">
      {pending ? "…" : "Show phone number"}
    </button>
  );
}

export function PhoneReveal({ listingId }: { listingId: string }) {
  const [state, formAction] = useFormState<PhoneState, FormData>(revealPhoneAction, { ok: false });

  if (state.ok && state.phone) {
    return (
      <a href={`tel:${state.phone}`}
        className="block w-full rounded-btn border border-brand px-4 py-2.5 text-center text-sm font-bold text-brand">
        {state.phone}
      </a>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <RevealButton />
      {state.error && <p role="alert" className="mt-1 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
