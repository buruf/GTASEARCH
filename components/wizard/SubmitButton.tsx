"use client";

import { useFormStatus } from "react-dom";

/** Shared submit button for wizard step forms: shows a pending state while
 *  the server action runs. */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
