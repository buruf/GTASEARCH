"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitClaimAction, type ClaimState } from "./actions";
import { CLAIM_ROLES } from "@/lib/validation";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit claim"}
    </button>
  );
}

export function ClaimForm({
  slug,
  defaultName,
  defaultEmail,
}: {
  slug: string;
  defaultName: string;
  defaultEmail: string;
}) {
  // `state` is optional: a successful submit redirects, which leaves
  // useFormState's state undefined on the way out. Every read is guarded —
  // the ReplyForm crash in Phase 3A was exactly this.
  const [state, formAction] = useFormState<ClaimState | undefined, FormData>(
    submitClaimAction,
    undefined,
  );

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="slug" value={slug} />

      {state?.error && (
        <p role="alert" className="rounded-btn bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="contactName" className="block text-sm font-medium text-ink">
          Your name
        </label>
        <input
          id="contactName"
          name="contactName"
          defaultValue={defaultName}
          required
          className="mt-1 h-11 w-full rounded-btn border border-line px-3 text-sm text-ink focus:border-brand"
        />
        {state?.fieldErrors?.contactName && (
          <p className="mt-1 text-xs text-red-700">{state.fieldErrors.contactName}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contactEmail" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            defaultValue={defaultEmail}
            required
            className="mt-1 h-11 w-full rounded-btn border border-line px-3 text-sm text-ink focus:border-brand"
          />
          <p className="mt-1 text-xs text-ink-faint">
            An email at the business&apos;s own domain helps us verify faster.
          </p>
          {state?.fieldErrors?.contactEmail && (
            <p className="mt-1 text-xs text-red-700">{state.fieldErrors.contactEmail}</p>
          )}
        </div>

        <div>
          <label htmlFor="contactPhone" className="block text-sm font-medium text-ink">
            Phone <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            className="mt-1 h-11 w-full rounded-btn border border-line px-3 text-sm text-ink focus:border-brand"
          />
        </div>
      </div>

      <div>
        <label htmlFor="roleAtBusiness" className="block text-sm font-medium text-ink">
          Your role
        </label>
        <select
          id="roleAtBusiness"
          name="roleAtBusiness"
          required
          className="mt-1 h-11 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink focus:border-brand sm:w-64"
        >
          {Object.entries(CLAIM_ROLES).map(([slugKey, label]) => (
            <option key={slugKey} value={slugKey}>
              {label}
            </option>
          ))}
        </select>
        {state?.fieldErrors?.roleAtBusiness && (
          <p className="mt-1 text-xs text-red-700">{state.fieldErrors.roleAtBusiness}</p>
        )}
      </div>

      <div>
        <label htmlFor="evidence" className="block text-sm font-medium text-ink">
          How can we check this is your business?
        </label>
        <textarea
          id="evidence"
          name="evidence"
          rows={4}
          required
          placeholder="Your website, your business number, an email address at your domain, or anything else we can match against public records."
          className="mt-1 w-full rounded-card border border-line p-3 text-sm text-ink focus:border-brand"
        />
        {state?.fieldErrors?.evidence && (
          <p className="mt-1 text-xs text-red-700">{state.fieldErrors.evidence}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
