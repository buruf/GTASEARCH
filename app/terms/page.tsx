import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern using GTASearch, the Greater Toronto Area classifieds marketplace.",
  alternates: { canonical: "/terms" },
};

const EFFECTIVE_DATE = "July 30, 2026";

const h2 = "mt-8 text-lg font-bold text-ink";
const p = "mt-3 text-sm leading-relaxed text-ink-muted";
const ul = "mt-3 list-disc space-y-1.5 pl-6 text-sm leading-relaxed text-ink-muted";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Terms of Service</h1>
      <p className="mt-1 text-sm text-ink-faint">Effective {EFFECTIVE_DATE}</p>

      <p className={p}>
        Welcome to GTASearch. These terms are an agreement between you and
        GTASearch (&ldquo;we&rdquo;, &ldquo;us&rdquo;) governing your use of
        gtasearch.com. By creating an account or posting a listing, you agree
        to them. If you do not agree, please do not use the site.
      </p>

      <h2 className={h2}>1. What GTASearch is — and is not</h2>
      <p className={p}>
        GTASearch is a venue where people in the Greater Toronto Area post
        classified listings and find each other. We are not a party to any
        transaction. We do not own, inspect, warehouse, deliver, or guarantee
        anything listed on the site, and we do not vet buyers or sellers.
        Every sale, trade, or service arrangement is strictly between the
        people involved.
      </p>

      <h2 className={h2}>2. Your account</h2>
      <ul className={ul}>
        <li>You must provide accurate information when registering.</li>
        <li>
          You are responsible for everything done under your account and for
          keeping your password secure.
        </li>
        <li>
          You must be at least the age of majority in your province (18 in
          Ontario) to post listings.
        </li>
      </ul>

      <h2 className={h2}>3. Listings and content</h2>
      <p className={p}>
        You keep ownership of the content you post, and you are responsible
        for it. By posting, you give us a non-exclusive licence to display,
        reproduce, and distribute that content for the purpose of operating
        and promoting the site (for example, showing your listing in search
        results and link previews).
      </p>
      <p className={p}>You agree not to post listings that:</p>
      <ul className={ul}>
        <li>are illegal to sell or advertise in Ontario or Canada — including
          weapons, illicit drugs, stolen property, counterfeit goods, and
          recalled products;</li>
        <li>are deceptive, fraudulent, or misleading, including bait
          listings and undisclosed defects material to the sale;</li>
        <li>infringe someone else&rsquo;s intellectual property or privacy;</li>
        <li>contain hateful, harassing, or sexually explicit material;</li>
        <li>advertise pyramid schemes, multi-level marketing recruitment, or
          &ldquo;work from home&rdquo; schemes requiring up-front payment; or</li>
        <li>are posted repeatedly, in the wrong category, or on behalf of an
          undisclosed commercial dropshipping operation.</li>
      </ul>
      <p className={p}>
        We may remove any listing, and suspend or terminate any account, at
        our discretion — including for conduct that violates the letter or the
        spirit of these rules. Listings expire automatically after 30 days.
      </p>

      <h2 className={h2}>4. Safety</h2>
      <p className={p}>
        Meet in busy public places, inspect items before paying, and never
        send deposits to people you have not met. Our{" "}
        <Link href="/" className="text-brand hover:underline">
          listing pages
        </Link>{" "}
        include safety tips. You deal with other users at your own risk.
      </p>

      <h2 className={h2}>5. Paid features</h2>
      <p className={p}>
        Posting is free. Optional paid placements (&ldquo;boosts&rdquo;) may
        be offered; their price and duration are shown before you pay. Boosts
        promote a listing — they are not an endorsement of it, and fees are
        non-refundable once the placement begins except where required by law
        or where we removed the listing in error.
      </p>

      <h2 className={h2}>6. Disclaimers and limits on our liability</h2>
      <p className={p}>
        The site is provided &ldquo;as is&rdquo; without warranties of any
        kind. To the maximum extent permitted by law, we are not liable for
        the conduct of users, the quality or legality of listed items, or any
        indirect, incidental, or consequential damages arising from your use
        of the site. Where liability cannot be excluded, our total liability
        is limited to the amount you paid us in the twelve months before the
        claim. Nothing in these terms limits rights that Ontario consumer
        protection law does not allow to be limited.
      </p>

      <h2 className={h2}>7. Changes and termination</h2>
      <p className={p}>
        We may update these terms; material changes will be posted here with a
        new effective date, and continued use after that constitutes
        acceptance. You may close your account at any time. We may suspend or
        end the service, or your access to it, with reasonable notice where
        practicable.
      </p>

      <h2 className={h2}>8. Governing law</h2>
      <p className={p}>
        These terms are governed by the laws of Ontario and the federal laws
        of Canada applicable in Ontario, and disputes belong to the courts of
        Ontario.
      </p>

      <h2 className={h2}>9. Contact</h2>
      <p className={p}>
        Questions about these terms: <strong>support@gtasearch.com</strong>.
        See also our{" "}
        <Link href="/privacy" className="text-brand hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
