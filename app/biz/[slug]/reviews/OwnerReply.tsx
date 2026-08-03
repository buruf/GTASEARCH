"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { respondToReviewAction, type ReviewState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Posting…" : "Post reply"}
    </button>
  );
}

/** Shown only to the business owner, and only ever adds a reply — there is no
 *  edit or delete here, by design. */
export function OwnerReply({
  reviewId,
  slug,
  existing,
}: {
  reviewId: string;
  slug: string;
  existing: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState<ReviewState | undefined, FormData>(
    respondToReviewAction,
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-sm font-medium text-brand hover:text-brand-dark"
      >
        {existing ? "Edit your reply" : "Reply as the owner"}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="slug" value={slug} />
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
      <textarea
        name="response"
        rows={3}
        defaultValue={existing ?? ""}
        placeholder="Thanks for the feedback…"
        className="w-full rounded-card border border-line p-3 text-sm text-ink focus:border-brand"
      />
      <div className="flex gap-2">
        <Submit />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-btn border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-alt hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
