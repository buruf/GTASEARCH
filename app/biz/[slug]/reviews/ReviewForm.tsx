"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { deleteReviewAction, submitReviewAction, type ReviewState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/** Radio-backed star picker: works without JavaScript and is keyboard-navigable. */
function RatingPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <fieldset className="mt-1">
      <legend className="sr-only">Rating</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name="rating"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
              required
            />
            <svg
              viewBox="0 0 20 20"
              className="h-8 w-8 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
              aria-hidden="true"
            >
              <path
                d="M10 1.6l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"
                fill={n <= value ? "#F5A623" : "#E0E0E0"}
              />
            </svg>
            <span className="sr-only">{n} star{n === 1 ? "" : "s"}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReviewForm({
  slug,
  existing,
}: {
  slug: string;
  existing: { rating: number; body: string } | null;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [state, formAction] = useFormState<ReviewState | undefined, FormData>(
    submitReviewAction,
    undefined,
  );
  const [deleteState, deleteAction] = useFormState<ReviewState | undefined, FormData>(
    deleteReviewAction,
    undefined,
  );

  const message = state?.error ?? deleteState?.error ?? state?.ok ?? deleteState?.ok;
  const isError = Boolean(state?.error ?? deleteState?.error);

  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <h3 className="text-base font-bold text-ink">
        {existing ? "Edit your review" : "Write a review"}
      </h3>

      {message && (
        <p
          role="status"
          className={`mt-3 rounded-btn px-3 py-2 text-sm ${
            isError ? "bg-red-50 text-red-800" : "bg-brand-50 text-ink"
          }`}
        >
          {message}
        </p>
      )}

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="slug" value={slug} />

        <div>
          <span className="block text-sm font-medium text-ink">Your rating</span>
          <RatingPicker value={rating} onChange={setRating} />
          {state?.fieldErrors?.rating && (
            <p className="mt-1 text-xs text-red-700">{state.fieldErrors.rating}</p>
          )}
        </div>

        <div>
          <label htmlFor="review-body" className="block text-sm font-medium text-ink">
            Your review
          </label>
          <textarea
            id="review-body"
            name="body"
            rows={5}
            defaultValue={existing?.body ?? ""}
            placeholder="What was your experience? Be specific and fair — this is about a real local business."
            className="mt-1 w-full rounded-card border border-line p-3 text-sm text-ink focus:border-brand"
          />
          {state?.fieldErrors?.body && (
            <p className="mt-1 text-xs text-red-700">{state.fieldErrors.body}</p>
          )}
        </div>

        <Submit label={existing ? "Update review" : "Post review"} />
      </form>

      {existing && (
        <form action={deleteAction} className="mt-3 border-t border-line pt-3">
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            Delete my review
          </button>
        </form>
      )}
    </div>
  );
}
