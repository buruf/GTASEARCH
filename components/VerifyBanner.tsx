"use client";

import { useState, useTransition } from "react";
import { resendVerificationAction } from "@/app/auth/actions";

/**
 * Shown on the dashboard to an account that has not confirmed its address.
 *
 * The gate itself lives in the server actions, where it cannot be bypassed.
 * This exists so the person meets the rule BEFORE they hit it — writing a
 * whole ad and being refused at the publish step is the worst possible moment
 * to learn about a requirement, and the commonest reason a real seller gives
 * up and never comes back.
 */
export function VerifyBanner({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="mb-6 rounded-card border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-ink">Confirm your email address</h2>
      <p className="mt-1 text-sm text-ink-muted">
        We sent a link to <strong>{email}</strong>. Until you click it you can
        browse and sign in, but you can&apos;t post an ad, message a seller,
        claim a business or leave a review.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await resendVerificationAction();
              // The success wording deliberately does not confirm anything
              // about the address itself — it is the same whether the mail
              // went out or the account was already verified.
              setMsg(r.ok ? "Sent. Check your inbox, and your spam folder." : (r.error ?? "Couldn't send that."));
            })
          }
          className="rounded-btn bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send it again"}
        </button>
        {msg && <span className="text-sm text-ink-muted">{msg}</span>}
      </div>
    </div>
  );
}
