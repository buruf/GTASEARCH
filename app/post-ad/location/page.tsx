import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep, STEP_ORDER, stepPath } from "@/lib/draft";
import { StepShell } from "@/components/wizard/StepShell";
import { LocationStepForm } from "./LocationStepForm";

export default async function LocationStepPage() {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");
  const gate = firstIncompleteStep(draft);
  if (STEP_ORDER.indexOf("location") > STEP_ORDER.indexOf(gate)) redirect(stepPath(gate));

  return (
    <StepShell current="location" maxReached={gate}>
      <h1 className="text-lg font-bold text-ink">Where is it located?</h1>
      <LocationStepForm defaults={{
        city: draft.city,
        neighbourhood: draft.neighbourhood ?? "",
        postalCode: draft.postalCode ?? "",
      }} />
    </StepShell>
  );
}
