import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How GTASearch collects, uses, and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

const EFFECTIVE_DATE = "July 30, 2026";

const h2 = "mt-8 text-lg font-bold text-ink";
const p = "mt-3 text-sm leading-relaxed text-ink-muted";
const ul = "mt-3 list-disc space-y-1.5 pl-6 text-sm leading-relaxed text-ink-muted";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Privacy Policy</h1>
      <p className="mt-1 text-sm text-ink-faint">Effective {EFFECTIVE_DATE}</p>

      <p className={p}>
        This policy explains what personal information GTASearch collects,
        why, and what control you have over it. We follow Canada&rsquo;s
        federal privacy law (PIPEDA) and collect only what the service needs
        to work.
      </p>

      <h2 className={h2}>What we collect</h2>
      <ul className={ul}>
        <li>
          <strong>Account information:</strong> your name, email address, a
          hashed version of your password (we never store the password
          itself), and an optional phone number if you add one.
        </li>
        <li>
          <strong>Sign in with Google:</strong> if you use it, Google shares
          your name and email with us. We never see your Google password.
        </li>
        <li>
          <strong>Listings:</strong> the titles, descriptions, prices, photos,
          city, and neighbourhood you post — all of which are public by
          design. An optional postal code, if you provide one, is{" "}
          <strong>never shown publicly</strong>; it exists only to support
          distance-based sorting.
        </li>
        <li>
          <strong>Technical basics:</strong> session cookies to keep you
          signed in, a short-lived cookie that stops repeated page refreshes
          from inflating view counts, and standard server logs (IP address,
          browser type) used for security and abuse prevention, including
          rate limiting.
        </li>
      </ul>
      <p className={p}>
        We do not run third-party advertising or tracking cookies, and we do
        not sell personal information to anyone.
      </p>

      <h2 className={h2}>How we use it</h2>
      <ul className={ul}>
        <li>To operate your account and display your listings.</li>
        <li>To let buyers and sellers communicate about listings.</li>
        <li>
          To send transactional email only — password resets and, in future,
          listing-expiry reminders. No marketing email without separate,
          explicit consent.
        </li>
        <li>To prevent fraud, spam, and abuse, and to moderate content.</li>
      </ul>

      <h2 className={h2}>Who processes it for us</h2>
      <p className={p}>
        Like nearly every website, we rely on a small set of service providers
        that process data on our behalf, under their own security programs:
        Vercel (hosting), Supabase (database), Cloudinary (photo storage),
        Google (optional sign-in), and Resend (transactional email). Payment
        card details for boost purchases, when offered, are handled entirely
        by Stripe — card numbers never touch our servers. Some providers
        store data outside Canada (typically in the United States).
      </p>

      <h2 className={h2}>How long we keep it</h2>
      <ul className={ul}>
        <li>Listings expire after 30 days and stop being publicly visible.</li>
        <li>
          Deleted listings are hidden immediately and purged from our systems
          on a periodic schedule.
        </li>
        <li>
          Account information is kept while your account exists. To close
          your account, contact us (below) and we will remove your personal
          information within 30 days, except records we must keep for legal,
          security, or fraud-prevention reasons.
        </li>
      </ul>

      <h2 className={h2}>Your choices and rights</h2>
      <ul className={ul}>
        <li>You can edit your name and phone number in your dashboard.</li>
        <li>You can delete any of your listings at any time.</li>
        <li>
          You can ask us what personal information we hold about you, ask us
          to correct it, or ask us to delete it.
        </li>
        <li>
          If you believe we have mishandled your information, you may also
          complain to the Office of the Privacy Commissioner of Canada.
        </li>
      </ul>

      <h2 className={h2}>Security</h2>
      <p className={p}>
        Passwords are stored only as bcrypt hashes; password-reset links are
        single-use, expire within an hour, and are stored hashed; all traffic
        is encrypted with HTTPS; and every change to a listing is checked
        server-side against the account that owns it. No system is perfectly
        secure, but we build with that assumption rather than against it.
      </p>

      <h2 className={h2}>Children</h2>
      <p className={p}>
        GTASearch is not directed to children and may not be used by anyone
        under the age of majority in their province.
      </p>

      <h2 className={h2}>Changes and contact</h2>
      <p className={p}>
        Material changes to this policy will be posted here with a new
        effective date. Questions or requests:{" "}
        <strong>support@gtasearch.com</strong>. See also our{" "}
        <Link href="/terms" className="text-brand hover:underline">
          Terms of Service
        </Link>
        .
      </p>
    </div>
  );
}
