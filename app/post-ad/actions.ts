"use server";

import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateDraft, getDraft, discardDraft } from "@/lib/draft";
import { CategoryStepSchema, DetailsStepSchema, LocationStepSchema, PhotosStepSchema } from "@/lib/validation";
import { cloudinaryConfig } from "@/lib/env";
import { publishDraft } from "@/lib/manage";
import { rateLimit } from "@/lib/rate-limit";
import { isBoostTierKey } from "@/lib/boost";
import { createBoostCheckout, StripeDisabledError } from "@/lib/stripe";
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

export async function savePhotos(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");

  const cfg = cloudinaryConfig();
  const images = formData.getAll("images").map(String).filter(Boolean);
  if (images.length > 0) {
    if (!cfg) return { ok: false, error: "Photo uploads aren't configured yet." };
    const parsed = PhotosStepSchema(cfg.cloudName).safeParse({ images });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  }
  await db.listing.update({ where: { id: draft.id }, data: { images } });
  redirect("/post-ad/boost");
}

export async function publishAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  if (!rateLimit(`publish:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "You've reached the daily posting limit." };
  }
  const r = await publishDraft(userId);
  if (!r.ok) return { ok: false, error: r.error };
  redirect(`/listing/${r.listingId}`);
}

/**
 * Wizard boost step, paid path (spec §4: publish first, then pay). The ad
 * goes live unconditionally; an abandoned checkout costs nothing. Free path
 * continues to review via the plain link.
 */
export async function publishWithBoostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const tier = String(formData.get("tier") ?? "");
  if (!isBoostTierKey(tier)) return { ok: false, error: "Pick a boost option." };
  if (!rateLimit(`publish:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "You've reached the daily posting limit." };
  }
  if (!rateLimit(`boost:${userId}`, 10, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Too many checkout attempts today." };
  }

  const r = await publishDraft(userId);
  if (!r.ok) return { ok: false, error: r.error };

  let url: string;
  try {
    url = await createBoostCheckout(userId, r.listingId, tier);
  } catch (e) {
    if (e instanceof StripeDisabledError) {
      // Ad is live; payment just isn't possible. Land on the listing honestly.
      redirect(`/listing/${r.listingId}`);
    }
    // Checkout failed but the ad is published — never strand the seller.
    redirect(`/listing/${r.listingId}?boost=checkout-failed`);
  }
  redirect(url);
}

export async function discardAndRestart(): Promise<void> {
  const userId = await requireUserId();
  await discardDraft(userId);
  redirect("/post-ad");
}
