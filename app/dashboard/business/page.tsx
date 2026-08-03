import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { businessesOwnedBy } from "@/lib/claims";
import { getBusinessCategoryLabel } from "@/lib/business-categories";
import { getCityLabel } from "@/lib/cities";
import { isPro, photoLimitFor } from "@/lib/plans";

export const metadata: Metadata = {
  title: "My businesses",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyBusinessesPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/auth/signin?callbackUrl=%2Fdashboard%2Fbusiness");

  const businesses = await businessesOwnedBy(userId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-bold text-ink sm:text-2xl">My businesses</h1>

      {businesses.length === 0 ? (
        <div className="mt-6 rounded-card border border-line bg-surface-alt p-6">
          <p className="text-sm text-ink-muted">
            You do not manage any businesses yet. Find your business in the
            directory and claim it — claiming is free.
          </p>
          <Link
            href="/"
            className="mt-3 inline-block rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Search the directory
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {businesses.map((b) => {
            const pro = isPro(b.plan, b.planRenewsAt);
            return (
              <li key={b.id} className="rounded-card border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-ink">
                      <Link href={`/biz/${b.slug}`} className="hover:text-brand">
                        {b.name}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {getBusinessCategoryLabel(b.category)} · {getCityLabel(b.city)}
                    </p>
                    <p className="mt-1 text-sm text-ink-faint">{b.address}</p>
                  </div>
                  <span
                    className={`rounded-btn px-2.5 py-1 text-xs font-semibold ${
                      pro ? "bg-brand text-white" : "bg-surface-alt text-ink-muted"
                    }`}
                  >
                    {pro ? "Pro" : "Free"}
                  </span>
                </div>

                <p className="mt-3 text-xs text-ink-faint">
                  {b.images.length} of {photoLimitFor(b.plan)} photos used
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/business/${b.id}`}
                    className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                  >
                    Edit listing
                  </Link>
                  {!pro && (
                    <Link
                      href={`/dashboard/business/${b.id}/upgrade`}
                      className="rounded-btn border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-50"
                    >
                      Upgrade to Pro
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
