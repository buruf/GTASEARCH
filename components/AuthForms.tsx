"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { registerAction, type FormState } from "@/app/auth/actions";

const input = "h-11 w-full rounded-btn border border-line px-3 text-sm focus:border-brand";
const label = "mt-3 block text-sm font-medium text-ink";
const button = "mt-5 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={button}>{pending ? "Please wait…" : children}</button>;
}

export function AuthForms({ tab, googleOn }: { tab: "signin" | "register"; googleOn: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const [signinError, setSigninError] = useState<string | null>(null);
  const [state, formAction] = useFormState<FormState, FormData>(registerAction, { ok: false });

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: f.get("email"), password: f.get("password"), redirect: false,
    });
    if (res?.error) setSigninError("Incorrect email or password.");
    else router.push(callbackUrl);
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-btn py-2 text-center text-sm font-semibold ${active ? "bg-brand text-white" : "text-ink-muted hover:text-ink"}`;

  return (
    <div className="mx-auto mt-8 w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
      <div className="flex gap-1 rounded-btn bg-surface-alt p-1">
        <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={tabClass(tab === "signin")}>Sign In</Link>
        <Link href={`/auth/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={tabClass(tab === "register")}>Register</Link>
      </div>

      {tab === "signin" ? (
        <form onSubmit={onSignIn} className="mt-4">
          <label className={label} htmlFor="si-email">Email</label>
          <input id="si-email" name="email" type="email" required autoComplete="email" className={input} />
          <label className={label} htmlFor="si-password">Password</label>
          <input id="si-password" name="password" type="password" required autoComplete="current-password" className={input} />
          {signinError && <p role="alert" className="mt-3 text-sm text-red-600">{signinError}</p>}
          <Submit>Sign in</Submit>
          <p className="mt-3 text-center text-sm">
            <Link href="/auth/forgot" className="text-brand hover:underline">Forgot password?</Link>
          </p>
        </form>
      ) : state.ok ? (
        <div className="mt-6 text-center">
          <p className="font-semibold text-ink">Check your details and sign in</p>
          <p className="mt-2 text-sm text-ink-muted">
            If that email was available, your account is ready — sign in with your new password.
          </p>
          <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
            Go to sign in
          </Link>
        </div>
      ) : (
        <form action={formAction} className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="firstName">First name</label>
              <input id="firstName" name="firstName" required maxLength={50} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="lastName">Last name</label>
              <input id="lastName" name="lastName" required maxLength={50} className={input} />
            </div>
          </div>
          <label className={label} htmlFor="re-email">Email</label>
          <input id="re-email" name="email" type="email" required autoComplete="email" className={input} />
          <label className={label} htmlFor="re-password">Password</label>
          <input id="re-password" name="password" type="password" required minLength={8} autoComplete="new-password" className={input} />
          <label className={label} htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" required className={input} />
          {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
          {state.fieldErrors && Object.values(state.fieldErrors).map((m) => (
            <p key={m} role="alert" className="mt-1 text-sm text-red-600">{m}</p>
          ))}
          <Submit>Create account</Submit>
        </form>
      )}

      {googleOn && (
        <>
          <div className="my-4 flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={() => signIn("google", { callbackUrl })} className="h-11 w-full rounded-btn border border-line text-sm font-semibold text-ink hover:border-brand">
            Continue with Google
          </button>
        </>
      )}
    </div>
  );
}
