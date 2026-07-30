import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep, stepPath } from "@/lib/draft";
import { StepShell } from "@/components/wizard/StepShell";
import { getCategoryLabel, getSubcategoryLabel } from "@/lib/categories";
import { getCityLabel } from "@/lib/cities";
import { formatPrice } from "@/lib/format";
import { PublishForm } from "./PublishForm";

function Section({
  title, editHref, children,
}: { title: string; editHref: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-4 first:pt-0 last:border-b-0">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Link href={editHref} className="text-sm text-brand hover:underline">Edit</Link>
      </div>
      <div className="mt-1 text-sm text-ink-muted">{children}</div>
    </div>
  );
}

export default async function ReviewStepPage() {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");
  const gate = firstIncompleteStep(draft);
  if (gate !== "review") redirect(stepPath(gate));

  return (
    <StepShell current="review" maxReached={gate}>
      <h1 className="text-lg font-bold text-ink">Review your ad</h1>
      <p className="mt-1 text-sm text-ink-muted">Check everything looks right, then publish.</p>

      <div className="mt-4">
        <Section title="Category" editHref="/post-ad">
          <p>
            {getCategoryLabel(draft.category)}
            {draft.subcategory ? ` — ${getSubcategoryLabel(draft.category, draft.subcategory)}` : ""}
          </p>
        </Section>

        <Section title="Details" editHref="/post-ad/details">
          <p className="font-medium text-ink">{draft.title}</p>
          <p className="mt-1 whitespace-pre-wrap">{draft.description}</p>
          <p className="mt-1 font-medium text-ink">{formatPrice(draft.price, draft.priceType)}</p>
        </Section>

        <Section title="Location" editHref="/post-ad/location">
          <p>{getCityLabel(draft.city)}{draft.neighbourhood ? ` — ${draft.neighbourhood}` : ""}</p>
          {draft.postalCode && <p>{draft.postalCode}</p>}
        </Section>

        <Section title="Photos" editHref="/post-ad/photos">
          <p>{draft.images.length} photo{draft.images.length === 1 ? "" : "s"}</p>
        </Section>

        <Section title="Boost" editHref="/post-ad/boost">
          <p>Free listing</p>
        </Section>
      </div>

      <PublishForm />
    </StepShell>
  );
}
