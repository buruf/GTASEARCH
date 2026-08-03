"use client";

import { useFormState, useFormStatus } from "react-dom";
import { moderateReviewAction, type ModerateState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-btn border border-line px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-alt hover:text-ink disabled:opacity-60"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

export function ModerateReview({ reviewId, status }: { reviewId: string; status: string }) {
  const [state, formAction] = useFormState<ModerateState | undefined, FormData>(
    moderateReviewAction,
    undefined,
  );
  const hidden = status === "hidden";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span
        className={`rounded-btn px-2 py-1 text-xs font-semibold ${
          hidden ? "bg-surface-alt text-ink-muted" : "bg-brand-50 text-ink"
        }`}
      >
        {hidden ? "Hidden" : "Published"}
      </span>
      <form action={formAction}>
        <input type="hidden" name="reviewId" value={reviewId} />
        <input type="hidden" name="status" value={hidden ? "published" : "hidden"} />
        <Submit label={hidden ? "Restore" : "Hide"} />
      </form>
      {(state?.error ?? state?.ok) && (
        <span
          role="status"
          className={`text-sm ${state?.error ? "text-red-700" : "text-ink-muted"}`}
        >
          {state?.error ?? state?.ok}
        </span>
      )}
    </div>
  );
}
