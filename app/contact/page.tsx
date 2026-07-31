import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach GTASearch for support, feedback, or reports.",
  alternates: { canonical: "/contact" },
};

const h2 = "mt-8 text-lg font-bold text-ink";
const p = "mt-3 text-sm leading-relaxed text-ink-muted";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Contact</h1>

      <h2 className={h2}>Report a problem listing</h2>
      <p className={p}>
        The fastest route: every listing page has a{" "}
        <strong>Report this ad</strong> link — it goes straight to our
        moderation queue, works without an account, and is anonymous to the
        seller.
      </p>

      <h2 className={h2}>A problem with a buyer or seller</h2>
      <p className={p}>
        GTASearch is a venue: transactions happen directly between users, so
        we can&rsquo;t reverse payments or mediate disputes. If you believe
        you&rsquo;ve encountered fraud, contact your local police service;
        for scams you can also report to the Canadian Anti-Fraud Centre at
        1-888-495-8501. Then report the listing so we can act on the account.
      </p>

      <h2 className={h2}>Everything else</h2>
      <p className={p}>
        Support, feedback, questions about these{" "}
        <Link href="/terms" className="text-brand hover:underline">Terms</Link>{" "}
        or your{" "}
        <Link href="/privacy" className="text-brand hover:underline">privacy</Link>:
        email <strong>support@gtasearch.com</strong>. We aim to reply within
        two business days.
      </p>
    </div>
  );
}
