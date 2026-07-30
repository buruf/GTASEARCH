"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "@/components/wizard/SubmitButton";
import { savePhotos } from "../actions";
import type { FormState } from "@/app/auth/actions";

/** Cloudinary degraded mode (spec §8): no images to upload, just move on. */
export function SkipPhotosForm() {
  const [state, formAction] = useFormState<FormState, FormData>(savePhotos, { ok: false });

  return (
    <form action={formAction} className="mt-4">
      {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
      <SubmitButton>Continue</SubmitButton>
    </form>
  );
}
