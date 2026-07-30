"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { DetailsFields } from "@/components/wizard/DetailsFields";
import { SubmitButton } from "@/components/wizard/SubmitButton";
import { saveDetails } from "../actions";
import type { FormState } from "@/app/auth/actions";

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
      <SubmitButton>Continue</SubmitButton>
      <p className="mt-3 text-center text-sm">
        <Link href="/post-ad" className="text-brand hover:underline">Back</Link>
      </p>
    </form>
  );
}
