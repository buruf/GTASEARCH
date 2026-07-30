"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { toggleSaved } from "@/lib/saved";

export async function toggleSavedAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  if (listingId) await toggleSaved(userId, listingId);
  // No redirect: a no-JS form post already re-renders the current route on
  // submission, and a JS client relies on useOptimistic for instant feedback
  // — redirecting here would force a full route refresh on every heart
  // click for JS clients too, defeating the optimistic UI. Revalidate every
  // place a heart can render so the server-rendered `saved` prop catches up.
  revalidatePath("/saved");
  revalidatePath("/");
  revalidatePath("/search");
}
