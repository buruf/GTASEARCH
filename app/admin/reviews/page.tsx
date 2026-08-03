import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { Stars } from "@/components/Stars";
import { ModerateReview } from "./ModerateReview";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  await requireAdmin();

  // Newest first: moderation is about catching abuse quickly, not triaging a
  // backlog like the claims queue.
  const reviews = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, rating: true, body: true, status: true, createdAt: true,
      user: { select: { email: true, name: true } },
      business: { select: { slug: true, name: true } },
    },
  });

  return (
    <div>
      <h2 className="text-lg font-bold text-ink">Recent reviews</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Hiding a review removes it from the business page and from its rating
        average. This is for abuse — spam, harassment, obvious fakes — not for
        opinions a business dislikes. Reviews are never edited, only hidden or
        restored.
      </p>

      {reviews.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface-alt p-6 text-sm text-ink-muted">
          Nobody has written a review yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <Link href={`/biz/${r.business.slug}`} className="text-sm font-bold text-ink hover:text-brand">
                    {r.business.name}
                  </Link>
                </div>
                <span className="text-xs text-ink-faint">
                  {r.user.name} · {r.user.email} · {r.createdAt.toLocaleDateString("en-CA")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{r.body}</p>
              <ModerateReview reviewId={r.id} status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
