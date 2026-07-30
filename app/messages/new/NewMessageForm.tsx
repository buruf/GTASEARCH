"use client";

import { useFormState, useFormStatus } from "react-dom";
import { startConversationAction } from "@/app/messages/actions";
import type { FormState } from "@/app/auth/actions";

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="h-11 rounded-btn bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? "Sending…" : "Send message"}
    </button>
  );
}

export function NewMessageForm({ listingId }: { listingId: string }) {
  const [state, formAction] = useFormState<FormState, FormData>(startConversationAction, { ok: false });

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="listingId" value={listingId} />
      <textarea
        name="content" required maxLength={2000} rows={4}
        placeholder="Hi, is this still available?"
        className="w-full rounded-btn border border-line p-3 text-sm focus:border-brand"
      />
      {/* startConversationAction redirects to a different route on success, so
          state is briefly undefined during that transition too. */}
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <Send />
    </form>
  );
}
