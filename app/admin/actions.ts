"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, dismissReports, removeListingWithReports, restoreListing } from "@/lib/admin";

// Every action re-checks admin: pages are convenience, actions are the gate.
async function guarded(fn: (listingId: string) => Promise<unknown>, formData: FormData) {
  await requireAdmin();
  const listingId = String(formData.get("listingId") ?? "");
  if (listingId) await fn(listingId);
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/listings");
}

export async function dismissReportsAction(formData: FormData) { await guarded(dismissReports, formData); }
export async function removeListingAction(formData: FormData) { await guarded(removeListingWithReports, formData); }
export async function restoreListingAction(formData: FormData) { await guarded(restoreListing, formData); }
