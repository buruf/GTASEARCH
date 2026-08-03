import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { pendingClaims } from "@/lib/claims";
import { CLAIM_ROLES } from "@/lib/validation";
import { getCityLabel } from "@/lib/cities";
import { ReviewButtons } from "./ReviewButtons";

export const dynamic = "force-dynamic";

export default async function AdminClaimsPage() {
  await requireAdmin();
  const claims = await pendingClaims();

  return (
    <div>
      <h2 className="text-lg font-bold text-ink">
        Pending claims{claims.length > 0 && ` (${claims.length})`}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Approving hands the listing to the claimant and turns on its verified
        badge, so check the evidence against the business&apos;s own website or
        public records first. Nothing else in the site can set that badge.
      </p>

      {claims.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface-alt p-6 text-sm text-ink-muted">
          No claims waiting. When a business owner claims their listing it will
          appear here.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {claims.map((c) => (
            <li key={c.id} className="rounded-card border border-line bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold text-ink">
                  <Link href={`/biz/${c.business.slug}`} className="hover:text-brand">
                    {c.business.name}
                  </Link>
                </h3>
                <span className="text-xs text-ink-faint">
                  {c.createdAt.toLocaleDateString("en-CA")}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {c.business.address}, {getCityLabel(c.business.city)}
              </p>

              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="text-ink-faint">Claimant</dt>
                  <dd className="text-ink">
                    {c.contactName} ({CLAIM_ROLES[c.roleAtBusiness] ?? c.roleAtBusiness})
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-ink-faint">Account</dt>
                  <dd className="text-ink">{c.user.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-ink-faint">Contact email</dt>
                  <dd className="text-ink">{c.contactEmail}</dd>
                </div>
                {c.contactPhone && (
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Phone given</dt>
                    <dd className="text-ink">{c.contactPhone}</dd>
                  </div>
                )}
                {/* The listing's own published contact details, so a reviewer
                    can compare them with what the claimant supplied without
                    opening another tab. */}
                {c.business.website && (
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Listed site</dt>
                    <dd>
                      <a
                        href={c.business.website}
                        rel="nofollow noopener"
                        target="_blank"
                        className="text-brand hover:text-brand-dark"
                      >
                        {c.business.website}
                      </a>
                    </dd>
                  </div>
                )}
                {c.business.phone && (
                  <div className="flex gap-2">
                    <dt className="text-ink-faint">Listed phone</dt>
                    <dd className="text-ink">{c.business.phone}</dd>
                  </div>
                )}
              </dl>

              <div className="mt-3 rounded-card bg-surface-alt p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Evidence given
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{c.evidence}</p>
              </div>

              <ReviewButtons claimId={c.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
