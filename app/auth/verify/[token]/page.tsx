import type { Metadata } from "next";
import Link from "next/link";
import { consumeVerificationToken } from "@/lib/email-verification";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

// The token is in the URL, so this must never be cached or prerendered: a
// stored response would either confirm somebody else's account or serve a
// stale "already used" to the person who just clicked.
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
}: {
  params: { token: string };
}) {
  const userId = await consumeVerificationToken(params.token);
  const ok = userId !== null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      {ok ? (
        <>
          <h1 className="text-2xl font-bold text-ink">Email confirmed</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Thanks — your account is fully set up. You can post an ad, message a
            seller, claim your business or leave a review.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/"
              className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Browse the directory
            </Link>
            <Link
              href="/post-ad"
              className="rounded-btn border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand"
            >
              Post an ad
            </Link>
          </div>
        </>
      ) : (
        <>
          {/* One message for unknown, expired and already-used links alike.
              Distinguishing them would let someone probing tokens learn which
              ones exist — and the useful next step is the same in all three
              cases anyway. */}
          <h1 className="text-2xl font-bold text-ink">That link didn&apos;t work</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            It may have expired, or already been used. Confirmation links last
            24 hours. Sign in and send yourself a fresh one from your dashboard.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Go to my dashboard
            </Link>
            <Link
              href="/contact"
              className="rounded-btn border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand hover:text-brand"
            >
              Contact support
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
