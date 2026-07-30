import Link from "next/link";
import { STEP_ORDER, stepPath, type WizardStep } from "@/lib/draft";

const LABELS: Record<WizardStep, string> = {
  category: "Category", details: "Details", location: "Location",
  photos: "Photos", boost: "Boost", review: "Review",
};

/** Wraps every wizard step: numbered progress indicator + card. Steps up to
 *  maxReached are links (backward navigation); later ones are inert. */
export function StepShell({
  current, maxReached, children,
}: { current: WizardStep; maxReached: WizardStep; children: React.ReactNode }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  const maxIdx = STEP_ORDER.indexOf(maxReached);
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ol className="flex items-center gap-1 text-xs">
        {STEP_ORDER.map((s, i) => {
          const active = i === currentIdx;
          const reachable = i <= maxIdx && !active;
          const cls = `flex-1 rounded-btn px-1 py-1.5 text-center font-medium ${
            active ? "bg-brand text-white" : reachable ? "bg-brand-50 text-brand" : "bg-surface-alt text-ink-faint"}`;
          return (
            <li key={s} className={cls} aria-current={active ? "step" : undefined}>
              {reachable ? <Link href={stepPath(s)}>{i + 1}. {LABELS[s]}</Link> : <>{i + 1}. {LABELS[s]}</>}
            </li>
          );
        })}
      </ol>
      <div className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card">{children}</div>
    </div>
  );
}
