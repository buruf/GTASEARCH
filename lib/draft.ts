import type { Listing } from "@prisma/client";
import { db } from "@/lib/db";

export type WizardStep = "category" | "details" | "location" | "photos" | "boost" | "review";

export const STEP_ORDER: WizardStep[] = ["category", "details", "location", "photos", "boost", "review"];

export function stepPath(step: WizardStep): string {
  return step === "category" ? "/post-ad" : `/post-ad/${step}`;
}

/**
 * The single source of truth for wizard gating (spec §4): every step's page
 * and action recompute this server-side, so URL-jumping to /review with an
 * empty draft always bounces to the first incomplete step. Photos and boost
 * are optional, so a draft with category+details+location is review-ready.
 * Thresholds mirror DetailsStepSchema (title ≥4, description ≥20).
 */
export function firstIncompleteStep(d: {
  category: string;
  title: string;
  description: string;
  city: string;
}): WizardStep {
  if (!d.category) return "category";
  if (d.title.trim().length < 4 || d.description.trim().length < 20) return "details";
  if (!d.city) return "location";
  return "review";
}

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function sweepStaleDrafts(userId: string): Promise<void> {
  await db.listing.deleteMany({
    where: { userId, status: "draft", createdAt: { lt: new Date(Date.now() - DRAFT_TTL_MS) } },
  });
}

export async function getDraft(userId: string): Promise<Listing | null> {
  await sweepStaleDrafts(userId);
  return db.listing.findFirst({ where: { userId, status: "draft" } });
}

export async function getOrCreateDraft(userId: string): Promise<Listing> {
  const existing = await getDraft(userId);
  if (existing) return existing;
  try {
    return await db.listing.create({
      data: {
        title: "", description: "", category: "", city: "",
        images: [], status: "draft", priceType: "fixed",
        // Placeholder; publish recomputes it as now + 30 days.
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userId,
      },
    });
  } catch (e: unknown) {
    // P2002 = another concurrent call won the partial-unique-index race
    // (one draft per user). Return the winner's draft instead of exploding.
    if ((e as { code?: string }).code !== "P2002") throw e;
    const winner = await db.listing.findFirst({ where: { userId, status: "draft" } });
    if (!winner) throw e; // won and then deleted — genuinely exceptional
    return winner;
  }
}

export async function discardDraft(userId: string): Promise<void> {
  await db.listing.deleteMany({ where: { userId, status: "draft" } });
}
