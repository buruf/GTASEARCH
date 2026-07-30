"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { forgotAction, type FormState } from "@/app/auth/actions";

const input = "h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
const label = "mt-3 block text-sm font-medium text-ink";
const button = "mt-5 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={button}>{pending ? "Please wait…" : "Send reset link"}</button>;
}

export function ForgotForm() {
  const [state, formAction] = useFormState<FormState, FormData>(forgotAction, { ok: false });

  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
      <h1 className="text-lg font-semibold text-ink">Reset your password</h1>

      {state.ok ? (
        <div className="mt-6 text-center">
          <p className="font-semibold text-ink">Check your inbox</p>
          <p className="mt-2 text-sm text-ink-muted">
            If an account exists for that address, a reset link is on its way. Check your inbox.
          </p>
          <Link href="/auth/signin" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form action={formAction} className="mt-4">
          <label className={label} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={input} />
          {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
          <Submit />
          <p className="mt-3 text-center text-sm">
            <Link href="/auth/signin" className="text-brand hover:underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </div>
  );
}
