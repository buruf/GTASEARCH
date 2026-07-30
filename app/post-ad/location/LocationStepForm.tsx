"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { LocationFields } from "@/components/wizard/LocationFields";
import { SubmitButton } from "@/components/wizard/SubmitButton";
import { saveLocation } from "../actions";
import type { FormState } from "@/app/auth/actions";

export function LocationStepForm({
  defaults,
}: {
  defaults: { city: string; neighbourhood: string; postalCode: string };
}) {
  const [state, formAction] = useFormState<FormState, FormData>(saveLocation, { ok: false });

  return (
    <form action={formAction} className="mt-4">
      <LocationFields defaults={defaults} fieldErrors={state.fieldErrors} />
      {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
      <SubmitButton>Continue</SubmitButton>
      <p className="mt-3 text-center text-sm">
        <Link href="/post-ad/details" className="text-brand hover:underline">Back</Link>
      </p>
    </form>
  );
}
