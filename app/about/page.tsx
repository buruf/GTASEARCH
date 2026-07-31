import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "GTASearch is a free, fast classifieds marketplace built exclusively for the Greater Toronto Area.",
  alternates: { canonical: "/about" },
};

const h2 = "mt-8 text-lg font-bold text-ink";
const p = "mt-3 text-sm leading-relaxed text-ink-muted";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">About GTASearch</h1>

      <p className={p}>
        GTASearch is a classifieds marketplace built for one place only: the
        Greater Toronto Area. Toronto, Mississauga, Brampton, Markham,
        Vaughan, Richmond Hill, Scarborough, Etobicoke, Oakville, Burlington,
        Ajax, Pickering, Oshawa, Newmarket and Barrie — and nowhere else.
      </p>

      <h2 className={h2}>Why another classifieds site?</h2>
      <p className={p}>
        Because buying and selling locally should be fast. No pages of ads
        from three provinces away, no cluttered interface, no fees to list.
        Posting an ad takes a couple of minutes, searching works even when
        you misspell something, and everything is built mobile-first because
        that&rsquo;s where classifieds actually happen.
      </p>

      <h2 className={h2}>What it costs</h2>
      <p className={p}>
        Posting is free and stays free. Sellers who want extra visibility can
        optionally boost a listing to the top of its category — that&rsquo;s
        the entire business model. No commissions, no cut of your sale, no
        charge to message anyone.
      </p>

      <h2 className={h2}>Safety first</h2>
      <p className={p}>
        Every listing page carries practical safety tips, phone numbers are
        never shown until a signed-in user asks, postal codes are never shown
        at all, and anyone — signed in or not — can{" "}
        <Link href="/search" className="text-brand hover:underline">
          report a listing
        </Link>{" "}
        that looks wrong. Meet in public, inspect before paying, and never
        send deposits to someone you haven&rsquo;t met.
      </p>

      <h2 className={h2}>Get in touch</h2>
      <p className={p}>
        Questions, feedback, or a problem with the site? See our{" "}
        <Link href="/contact" className="text-brand hover:underline">
          contact page
        </Link>
        .
      </p>
    </div>
  );
}
