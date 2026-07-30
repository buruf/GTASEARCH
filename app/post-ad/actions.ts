"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateDraft, getDraft, discardDraft } from "@/lib/draft";
import { CategoryStepSchema, DetailsStepSchema, LocationStepSchema } from "@/lib/validation";
import type { FormState } from "@/app/auth/actions";

export async function saveCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = CategoryStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const draft = await getOrCreateDraft(userId);
  await db.listing.update({
    where: { id: draft.id },
    data: { category: parsed.data.category, subcategory: parsed.data.subcategory || null },
  });
  redirect("/post-ad/details");
}

export async function saveDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");

  const parsed = DetailsStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, fieldErrors };
  }
  await db.listing.update({
    where: { id: draft.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      priceType: parsed.data.priceType,
      price: parsed.data.price,
    },
  });
  redirect("/post-ad/location");
}

export async function saveLocation(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");

  const parsed = LocationStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, fieldErrors };
  }
  await db.listing.update({
    where: { id: draft.id },
    data: {
      city: parsed.data.city,
      neighbourhood: parsed.data.neighbourhood || null,
      postalCode: parsed.data.postalCode || null,
    },
  });
  redirect("/post-ad/photos");
}

export async function discardAndRestart(): Promise<void> {
  const userId = await requireUserId();
  await discardDraft(userId);
  redirect("/post-ad");
}
