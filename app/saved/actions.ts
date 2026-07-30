"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { toggleSaved } from "@/lib/saved";

export async function toggleSavedAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  if (listingId) await toggleSaved(userId, listingId);
  revalidatePath("/saved");
  // Progressive enhancement: without JS the form navigates; send them back.
  if (returnTo.startsWith("/")) redirect(returnTo);
}
