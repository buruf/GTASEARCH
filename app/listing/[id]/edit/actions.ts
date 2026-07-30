"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownedListing, NotOwnerError } from "@/lib/manage";
import { DetailsStepSchema, LocationStepSchema, PhotosStepSchema } from "@/lib/validation";
import { violatesModeration } from "@/lib/moderation";
import { cloudinaryConfig } from "@/lib/env";
import type { FormState } from "@/app/auth/actions";

async function guard(formData: FormData): Promise<{ userId: string; listingId: string } | null> {
  const userId = await requireUserId();
  const listingId = String(formData.get("listingId") ?? "");
  try {
    await ownedListing(userId, listingId);
    return { userId, listingId };
  } catch (e) {
    if (e instanceof NotOwnerError) return null;
    throw e;
  }
}

export async function updateDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await guard(formData);
  if (!ctx) return { ok: false, error: "You can't edit this listing." };

  const parsed = DetailsStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, fieldErrors };
  }
  if (violatesModeration(`${parsed.data.title}\n${parsed.data.description}`)) {
    return { ok: false, error: "These changes can't be published as written." };
  }
  await db.listing.update({ where: { id: ctx.listingId }, data: {
    title: parsed.data.title, description: parsed.data.description,
    priceType: parsed.data.priceType, price: parsed.data.price,
  }});
  revalidatePath(`/listing/${ctx.listingId}`);
  return { ok: true };
}

export async function updateLocation(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await guard(formData);
  if (!ctx) return { ok: false, error: "You can't edit this listing." };
  const parsed = LocationStepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db.listing.update({ where: { id: ctx.listingId }, data: {
    city: parsed.data.city, neighbourhood: parsed.data.neighbourhood || null, postalCode: parsed.data.postalCode || null,
  }});
  revalidatePath(`/listing/${ctx.listingId}`);
  return { ok: true };
}

export async function updatePhotos(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await guard(formData);
  if (!ctx) return { ok: false, error: "You can't edit this listing." };
  const images = formData.getAll("images").map(String).filter(Boolean);
  const cfg = cloudinaryConfig();
  if (images.length > 0) {
    if (!cfg) return { ok: false, error: "Photo uploads aren't configured yet." };
    const parsed = PhotosStepSchema(cfg.cloudName).safeParse({ images });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  }
  await db.listing.update({ where: { id: ctx.listingId }, data: { images } });
  revalidatePath(`/listing/${ctx.listingId}`);
  return { ok: true };
}
