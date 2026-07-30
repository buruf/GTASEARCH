"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { DetailsFields } from "@/components/wizard/DetailsFields";
import { saveDetails } from "../actions";
import type { FormState } from "@/app/auth/actions";

const button = "mt-5 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={button}>{pending ? "Please wait…" : "Continue"}</button>;
}

export function DetailsStepForm({
  defaults,
}: {
  defaults: { title: string; description: string; priceType: string; price: string };
}) {
  const [state, formAction] = useFormState<FormState, FormData>(saveDetails, { ok: false });

  return (
    <form action={formAction} className="mt-4">
      <DetailsFields defaults={defaults} fieldErrors={state.fieldErrors} />
      {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
      <Submit />
      <p className="mt-3 text-center text-sm">
        <Link href="/post-ad" className="text-brand hover:underline">Back</Link>
      </p>
    </form>
  );
}
