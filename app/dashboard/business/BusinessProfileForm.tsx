"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateBusinessProfile, type OwnerState } from "./actions";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function BusinessProfileForm({
  businessId,
  description,
  phone,
  website,
  hours,
}: {
  businessId: string;
  description: string;
  phone: string;
  website: string;
  hours: string;
}) {
  // `state?.` throughout — a redirecting or resetting action leaves it
  // undefined (the ReplyForm crash in Phase 3A).
  const [state, formAction] = useFormState<OwnerState | undefined, FormData>(
    updateBusinessProfile,
    undefined,
  );

  const field = "mt-1 w-full rounded-btn border border-line px-3 text-sm text-ink focus:border-brand";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />

      {state?.error && (
        <p role="alert" className="rounded-btn bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-btn bg-brand-50 px-3 py-2 text-sm text-ink">
          {state.ok}
        </p>
      )}

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-ink">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={description}
          className={`${field} p-3`}
        />
        {state?.fieldErrors?.description && (
          <p className="mt-1 text-xs text-red-700">{state.fieldErrors.description}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-ink">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" defaultValue={phone} className={`${field} h-11`} />
        </div>
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-ink">
            Website
          </label>
          <input
            id="website"
            name="website"
            type="url"
            placeholder="https://"
            defaultValue={website}
            className={`${field} h-11`}
          />
          {state?.fieldErrors?.website && (
            <p className="mt-1 text-xs text-red-700">{state.fieldErrors.website}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="hours" className="block text-sm font-medium text-ink">
          Hours
        </label>
        <input
          id="hours"
          name="hours"
          defaultValue={hours}
          placeholder="Mon–Fri 9–6, Sat 10–4, Sun closed"
          className={`${field} h-11`}
        />
        {state?.fieldErrors?.hours && (
          <p className="mt-1 text-xs text-red-700">{state.fieldErrors.hours}</p>
        )}
      </div>

      <Save />
    </form>
  );
}
