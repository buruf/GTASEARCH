"use client";

import { useFormState, useFormStatus } from "react-dom";
import { resetAction, type FormState } from "@/app/auth/actions";

const input = "h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
const label = "mt-3 block text-sm font-medium text-ink";
const button = "mt-5 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={button}>{pending ? "Please wait…" : "Set new password"}</button>;
}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(resetAction, { ok: false });

  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
      <h1 className="text-lg font-semibold text-ink">Choose a new password</h1>

      <form action={formAction} className="mt-4">
        <input type="hidden" name="token" value={token} />
        <label className={label} htmlFor="password">New password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
        <label className={label} htmlFor="confirm">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={input} />
        {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
        <Submit />
      </form>
    </div>
  );
}
