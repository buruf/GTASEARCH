import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep, STEP_ORDER, stepPath } from "@/lib/draft";
import { StepShell } from "@/components/wizard/StepShell";
import { DetailsStepForm } from "./DetailsStepForm";

export default async function DetailsStepPage() {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");
  const gate = firstIncompleteStep(draft);
  if (STEP_ORDER.indexOf("details") > STEP_ORDER.indexOf(gate)) redirect(stepPath(gate));

  return (
    <StepShell current="details" maxReached={gate}>
      <h1 className="text-lg font-bold text-ink">Describe your item</h1>
      <DetailsStepForm defaults={{
        title: draft.title,
        description: draft.description,
        priceType: draft.priceType,
        price: draft.price?.toString() ?? "",
      }} />
    </StepShell>
  );
}
