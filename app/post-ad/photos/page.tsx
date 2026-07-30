import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep, STEP_ORDER, stepPath } from "@/lib/draft";
import { cloudinaryConfig } from "@/lib/env";
import { StepShell } from "@/components/wizard/StepShell";
import { PhotoUploader } from "@/components/wizard/PhotoUploader";
import { SkipPhotosForm } from "./SkipPhotosForm";

export default async function PhotosStepPage() {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");
  const gate = firstIncompleteStep(draft);
  if (STEP_ORDER.indexOf("photos") > STEP_ORDER.indexOf(gate)) redirect(stepPath(gate));

  const cfg = cloudinaryConfig();
  return (
    <StepShell current="photos" maxReached={gate}>
      <h1 className="text-lg font-bold text-ink">Add photos</h1>
      {cfg ? (
        <PhotoUploader cloudName={cfg.cloudName} uploadPreset={cfg.uploadPreset} initial={draft.images} />
      ) : (
        <div className="mt-4">
          <p className="rounded-card bg-surface-alt px-4 py-3 text-sm text-ink-muted">
            Photo uploads aren&apos;t configured yet. You can publish without photos and add them later.
          </p>
          <SkipPhotosForm />
        </div>
      )}
    </StepShell>
  );
}
