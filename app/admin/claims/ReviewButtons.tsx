"use client";

import { useFormState, useFormStatus } from "react-dom";
import { approveClaimAction, rejectClaimAction, type ReviewState } from "./actions";

function Submit({ label, tone }: { label: string; tone: "approve" | "reject" }) {
  const { pending } = useFormStatus();
  const base = "rounded-btn px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60";
  const cls =
    tone === "approve"
      ? `${base} bg-brand text-white hover:bg-brand-dark`
      : `${base} border border-line text-ink-muted hover:bg-surface-alt hover:text-ink`;
  return (
    <button type="submit" disabled={pending} className={cls}>
      {pending ? "Working…" : label}
    </button>
  );
}

export function ReviewButtons({ claimId }: { claimId: string }) {
  const [approveState, approve] = useFormState<ReviewState | undefined, FormData>(
    approveClaimAction,
    undefined,
  );
  const [rejectState, reject] = useFormState<ReviewState | undefined, FormData>(
    rejectClaimAction,
    undefined,
  );
  // Guarded reads throughout — an action that redirected or reset would leave
  // these undefined.
  const message = approveState?.error ?? rejectState?.error ?? approveState?.ok ?? rejectState?.ok;
  const isError = Boolean(approveState?.error ?? rejectState?.error);

  return (
    <div className="mt-3">
      {message && (
        <p
          role="status"
          className={`mb-2 rounded-btn px-3 py-2 text-sm ${
            isError ? "bg-red-50 text-red-800" : "bg-brand-50 text-ink"
          }`}
        >
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <form action={approve} className="flex items-end gap-2">
          <input type="hidden" name="claimId" value={claimId} />
          <div>
            <label htmlFor={`note-a-${claimId}`} className="block text-xs text-ink-faint">
              Note (optional)
            </label>
            <input
              id={`note-a-${claimId}`}
              name="note"
              className="h-9 w-56 rounded-btn border border-line px-2 text-sm text-ink focus:border-brand"
            />
          </div>
          <Submit label="Approve" tone="approve" />
        </form>
        <form action={reject}>
          <input type="hidden" name="claimId" value={claimId} />
          <input type="hidden" name="note" value="" />
          <Submit label="Reject" tone="reject" />
        </form>
      </div>
    </div>
  );
}
