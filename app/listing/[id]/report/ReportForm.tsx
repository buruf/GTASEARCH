"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { REPORT_REASONS } from "@/lib/validation";
import { submitReportAction } from "./actions";
import type { FormState } from "@/app/auth/actions";

const button = "mt-5 h-11 w-full rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={button}>{pending ? "Please wait…" : "Send report"}</button>;
}

export function ReportForm({ listingId }: { listingId: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(submitReportAction, { ok: false });
  const reasons = Object.entries(REPORT_REASONS);

  if (state.ok) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 text-center">
        <p className="font-semibold text-ink">Thanks — our team will take a look.</p>
        <p className="mt-2 text-sm text-ink-muted">Reports are anonymous to the seller.</p>
        <Link href={`/listing/${listingId}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
          Back to the listing
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-card border border-line bg-surface p-6">
      <input type="hidden" name="listingId" value={listingId} />

      <fieldset>
        <legend className="text-sm font-medium text-ink">Reason</legend>
        <div className="mt-1 flex flex-col gap-2 text-sm">
          {reasons.map(([slug, label], i) => (
            <label key={slug} className="flex items-center gap-1.5">
              <input type="radio" name="reason" value={slug} defaultChecked={i === 0} className="h-4 w-4 text-brand" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block text-sm font-medium text-ink" htmlFor="details">
        Details (optional)
      </label>
      <textarea
        id="details" name="details" rows={3} maxLength={500}
        className="mt-1 w-full rounded-btn border border-line p-3 text-sm focus:border-brand"
      />

      {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}

      <Submit />
    </form>
  );
}
