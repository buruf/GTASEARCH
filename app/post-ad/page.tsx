import type { Metadata } from "next";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep } from "@/lib/draft";
import { CATEGORIES, getCategoryLabel } from "@/lib/categories";
import { StepShell } from "@/components/wizard/StepShell";
import { CategoryForm } from "./CategoryForm";
import { discardAndRestart } from "./actions";

export const metadata: Metadata = { title: "Post an ad", robots: { index: false } };

export default async function CategoryStepPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  const resume = draft ? firstIncompleteStep(draft) : null;

  // "Post the first ad in Jobs" on an empty category page links here with the
  // category attached. Without this it was dropped silently and the wizard
  // opened on a blank "What are you posting?" — a promise the link did not
  // keep. An unrecognised value is ignored rather than 500ing, and a draft the
  // seller already started always beats a suggestion from a URL.
  const suggested =
    searchParams.category && CATEGORIES.some((c) => c.slug === searchParams.category)
      ? searchParams.category
      : "";

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
        defaultCategory={draft?.category || suggested}
        defaultSubcategory={draft?.subcategory ?? ""}
      />
    </StepShell>
  );
}
