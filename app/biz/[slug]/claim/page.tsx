import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { claimFor } from "@/lib/claims";
import { ClaimForm } from "./ClaimForm";

export const metadata: Metadata = {
  title: "Claim your business",
  // A claim form is a transaction, not a landing page — keep it out of search.
  robots: { index: false, follow: false },
};

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { submitted?: string };
}) {
  const business = await db.business.findUnique({
    where: { slug: params.slug },
    select: { id: true, slug: true, name: true, address: true, city: true, claimedById: true, status: true },
  });
  if (!business || business.status !== "active") notFound();

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/biz/${business.slug}/claim`)}`);
  }

  const existing = await claimFor(business.id, session.user.id);
  const submitted = searchParams.submitted === "1";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href={`/biz/${business.slug}`} className="hover:text-brand">
          ← Back to {business.name}
        </Link>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">
        Claim {business.name}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {business.address}
      </p>

      {business.claimedById && business.claimedById !== session.user.id ? (
        <p className="mt-6 rounded-card border border-line bg-surface-alt p-4 text-sm text-ink-muted">
          This business has already been claimed. If that is wrong,{" "}
          <Link href="/contact" className="font-medium text-brand hover:text-brand-dark">
            contact us
          </Link>{" "}
          and we will sort it out.
        </p>
      ) : business.claimedById === session.user.id ? (
        <p className="mt-6 rounded-card border border-line bg-brand-50 p-4 text-sm text-ink">
          You already manage this business.{" "}
          <Link href="/dashboard/business" className="font-medium text-brand hover:text-brand-dark">
            Go to your businesses
          </Link>
          .
        </p>
      ) : submitted || existing?.status === "pending" ? (
        <div className="mt-6 rounded-card border border-line bg-brand-50 p-5">
          <h2 className="text-base font-bold text-ink">Claim submitted</h2>
          <p className="mt-2 text-sm text-ink-muted">
            We review claims by hand and will get back to you. Because we check
            each one against public records rather than sending an automatic
            code, this usually takes a day or two.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            You can update your claim by submitting the form again — it replaces
            your existing request rather than adding a second one.
          </p>
        </div>
      ) : (
        <>
          {existing?.status === "rejected" && (
            <div className="mt-6 rounded-card border border-line bg-surface-alt p-4">
              <p className="text-sm font-medium text-ink">
                A previous claim of yours was not approved.
              </p>
              {existing.reviewNote && (
                <p className="mt-1 text-sm text-ink-muted">{existing.reviewNote}</p>
              )}
              <p className="mt-1 text-sm text-ink-muted">
                You can try again below with more detail.
              </p>
            </div>
          )}

          <div className="mt-6 rounded-card border border-line bg-surface-alt p-4 text-sm text-ink-muted">
            <p className="font-medium text-ink">Claiming is free.</p>
            <p className="mt-1">
              Once approved you can correct your details, add photos and hours,
              and your listing shows a verified badge. There is an optional paid
              plan, but nothing about claiming or keeping your listing accurate
              costs anything.
            </p>
          </div>

          <ClaimForm
            slug={business.slug}
            defaultName={session.user.name ?? ""}
            defaultEmail={session.user.email ?? ""}
          />
        </>
      )}
    </div>
  );
}
