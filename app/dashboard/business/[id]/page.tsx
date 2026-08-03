import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { ClaimError, ownedBusiness } from "@/lib/claims";
import { isPro, photoLimitFor } from "@/lib/plans";
import { BusinessProfileForm } from "../BusinessProfileForm";
import { BusinessPhotos } from "../BusinessPhotos";

export const metadata: Metadata = {
  title: "Edit business",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditBusinessPage({ params }: { params: { id: string } }) {
  const userId = await currentUserId();
  if (!userId) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/dashboard/business/${params.id}`)}`);
  }

  let business;
  try {
    business = await ownedBusiness(userId, params.id);
  } catch (err) {
    // 404 rather than 403: a stranger poking at ids should not learn which
    // ones exist.
    if (err instanceof ClaimError) notFound();
    throw err;
  }

  const pro = isPro(business.plan, business.planRenewsAt);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-muted">
        <Link href="/dashboard/business" className="hover:text-brand">
          ← My businesses
        </Link>
      </nav>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">{business.name}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        <Link href={`/biz/${business.slug}`} className="text-brand hover:text-brand-dark">
          View public listing
        </Link>
      </p>

      <p className="mt-4 rounded-card border border-line bg-surface-alt p-4 text-sm text-ink-muted">
        Name, category and address come from public municipal records and are
        not editable here — that is what keeps a verified listing verifiable.
        If any of them is wrong,{" "}
        <Link href="/contact" className="font-medium text-brand hover:text-brand-dark">
          tell us
        </Link>{" "}
        and we will correct it.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink">Details</h2>
        <div className="mt-4">
          <BusinessProfileForm
            businessId={business.id}
            description={business.description}
            phone={business.phone ?? ""}
            website={business.website ?? ""}
            hours={business.hours ?? ""}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">Photos</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Up to {photoLimitFor(business.plan)} photos on your{" "}
          {pro ? "Pro" : "free"} plan.{" "}
          {!pro && (
            <Link
              href={`/dashboard/business/${business.id}/upgrade`}
              className="font-medium text-brand hover:text-brand-dark"
            >
              Upgrade for more
            </Link>
          )}
        </p>
        <div className="mt-4">
          <BusinessPhotos
            businessId={business.id}
            initial={business.images}
            limit={photoLimitFor(business.plan)}
          />
        </div>
      </section>
    </div>
  );
}
