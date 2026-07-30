"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { replyAction } from "@/app/messages/actions";
import type { FormState } from "@/app/auth/actions";

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="h-11 shrink-0 rounded-btn bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? "Sending…" : "Send"}
    </button>
  );
}

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(replyAction, { ok: false });
  const ref = useRef<HTMLFormElement>(null);

  // replyAction no longer redirects (it stays on this same route), so on
  // success clear the textarea instead of relying on a navigation to reset it.
  // `state` is also briefly undefined mid-transition, so every read below is
  // optional-chained.
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex gap-2">
        <textarea
          name="content" required maxLength={2000} rows={2}
          placeholder="Write a message…"
          className="w-full rounded-btn border border-line p-3 text-sm focus:border-brand"
        />
        <Send />
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
