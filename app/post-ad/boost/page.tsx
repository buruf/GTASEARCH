import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getDraft, firstIncompleteStep, STEP_ORDER, stepPath } from "@/lib/draft";
import { StepShell } from "@/components/wizard/StepShell";

const PAID_BOOSTS = [
  { name: "Top ad", price: "$4.99", duration: "7 days" },
  { name: "Featured", price: "$9.99", duration: "14 days" },
  { name: "Super Boost", price: "$14.99", duration: "30 days" },
];

export default async function BoostStepPage() {
  const userId = await requireUserId();
  const draft = await getDraft(userId);
  if (!draft) redirect("/post-ad");
  const gate = firstIncompleteStep(draft);
  if (STEP_ORDER.indexOf("boost") > STEP_ORDER.indexOf(gate)) redirect(stepPath(gate));

  return (
    <StepShell current="boost" maxReached={gate}>
      <h1 className="text-lg font-bold text-ink">Want more eyes on your ad?</h1>
      <p className="mt-1 text-sm text-ink-muted">Boosts are coming soon. Your ad publishes for free either way.</p>

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-center gap-3 rounded-card border-2 border-brand bg-brand-50 p-4">
          <input type="radio" name="boost" value="free" checked readOnly className="h-4 w-4" />
          <div>
            <p className="text-sm font-semibold text-ink">Free listing</p>
            <p className="text-xs text-ink-muted">Standard placement, 30 days.</p>
          </div>
        </label>

        {PAID_BOOSTS.map((b) => (
          <div key={b.name} className="flex items-center gap-3 rounded-card border border-line p-4 opacity-60">
            <input type="radio" name="boost" disabled className="h-4 w-4" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">{b.name} — {b.price} / {b.duration}</p>
              <p className="text-xs text-ink-muted">Priority placement and highlighting.</p>
            </div>
            <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-ink-faint">
              Available soon
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/post-ad/review"
        className="mt-6 flex h-11 w-full items-center justify-center rounded-btn bg-brand text-sm font-semibold text-white hover:bg-brand-dark"
      >
        Continue
      </Link>
    </StepShell>
  );
}
