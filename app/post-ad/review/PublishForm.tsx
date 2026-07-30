"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/wizard/SubmitButton";
import { publishAction } from "../actions";
import type { FormState } from "@/app/auth/actions";

export function PublishForm() {
  const [state, formAction] = useFormState<FormState, FormData>(publishAction, { ok: false });

  return (
    <form action={formAction} className="mt-6">
      {state.error && <p role="alert" className="mb-3 text-sm text-red-600">{state.error}</p>}
      <SubmitButton>Publish your ad</SubmitButton>
    </form>
  );
}
