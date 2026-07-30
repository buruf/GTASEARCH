import type { Metadata } from "next";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep } from "@/lib/draft";
import { CATEGORIES } from "@/lib/categories";
import { StepShell } from "@/components/wizard/StepShell";
import { CategoryForm } from "./CategoryForm";
import { discardAndRestart } from "./actions";
import { getCategoryLabel } from "@/lib/categories";

export const metadata: Metadata = { title: "Post an ad", robots: { index: false } };

export default async function CategoryStepPage() {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  const resume = draft ? firstIncompleteStep(draft) : null;

  return (
    <StepShell current="category" maxReached={resume ?? "category"}>
      <h1 className="text-lg font-bold text-ink">What are you posting?</h1>

      {draft && draft.title && (
        <div className="mt-3 flex items-center justify-between rounded-card bg-brand-50 px-4 py-3 text-sm">
          <p className="text-ink">
            You have a draft: <strong>{draft.title}</strong>
            {draft.category ? ` (${getCategoryLabel(draft.category)})` : ""}
          </p>
          <form action={discardAndRestart}>
            <button type="submit" className="font-medium text-red-600 hover:underline">Discard</button>
          </form>
        </div>
      )}

      <CategoryForm
        categories={CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, icon: c.icon, subcategories: c.subcategories }))}
        defaultCategory={draft?.category ?? ""}
        defaultSubcategory={draft?.subcategory ?? ""}
      />
    </StepShell>
  );
}
