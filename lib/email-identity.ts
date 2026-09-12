// One inbox, one account.
//
// GTASearch enforced uniqueness on the email string as typed, which is not the
// same thing as the mailbox behind it. Between 2026-09-04 and 2026-09-12 that
// gap was used to register 131 accounts:
//
//   kle.an.o.l.og.y.fo.r.y.ou@gmail.com   ← kleanologyforyou@gmail.com
//   r.ob.e.r.t.sbo.d.ysh.o.p.p@gmail.com  ← robertsbodyshopp@gmail.com
//
// Gmail ignores dots in the local part and everything after a "+", so all of
// those deliver to one mailbox. Every address is distinct as a string, which
// is why a unique index on `email` never fired once.
//
// Canonicalising collapses the alias back to the inbox, so an attacker needs a
// real new mailbox per account rather than a regex.

/** Providers that ignore dots in the local part. Gmail is the only major one;
 *  adding others here needs evidence, because collapsing dots for a provider
 *  that treats them as significant would merge two real, different people. */
const DOT_BLIND_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Domains that alias to another. Kept explicit rather than guessed. */
const DOMAIN_ALIASES: Record<string, string> = {
  "googlemail.com": "gmail.com",
};

/**
 * The mailbox an address actually reaches, lowercased.
 *
 * Sub-addressing ("+tag") is stripped for every provider: it is an explicit
 * standard for routing to one's own inbox, so two addresses differing only by
 * tag are the same person by definition. Dot-stripping is NOT universal and is
 * applied only to the providers above.
 */
export function canonicalEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  domain = DOMAIN_ALIASES[domain] ?? domain;
  // Sub-addressing: everything from the first "+" is a label, not an address.
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (DOT_BLIND_DOMAINS.has(domain)) local = local.replace(/\./g, "");

  // A local part that was ONLY dots or a bare tag is not a real mailbox; keep
  // the original rather than collapsing unrelated addresses to "@gmail.com".
  if (!local) return trimmed;

  return `${local}@${domain}`;
}

/**
 * Throwaway-inbox providers.
 *
 * Deliberately short and specific. A long scraped blocklist ages badly and
 * eventually refuses a real person's real provider, which is a worse failure
 * than letting one disposable address through — a directory needs business
 * owners to be able to sign up. These are services whose entire purpose is an
 * inbox that expires, so nobody reaching for one is trying to claim a listing
 * they will still own next month.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com",
  "10minutemail.com", "tempmail.com", "temp-mail.org", "throwawaymail.com",
  "yopmail.com", "trashmail.com", "getnada.com", "dispostable.com",
  "maildrop.cc", "fakeinbox.com", "mytemp.email", "emailondeck.com",
  "mohmal.com", "tempinbox.com", "spamgourmet.com", "mailnesia.com",
]);

export function isDisposableEmail(raw: string): boolean {
  const domain = raw.trim().toLowerCase().split("@")[1];
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

/**
 * Signals that the submitter was not a person filling in a form.
 *
 * `website` is a honeypot: the field is present in the DOM, hidden from sight
 * and from screen readers, and labelled the way an autofill-hungry bot expects.
 * A human never sees it, so any value at all is an automated submission.
 *
 * `elapsedMs` is how long the form was on screen. The register form stamps its
 * render time; a submission arriving within two seconds was not typed. The
 * bound is generous on purpose — a fast human with a password manager takes
 * several seconds, and refusing a real signup is worse than admitting a patient
 * bot, which the other checks still have to get past.
 */
export const MIN_FORM_FILL_MS = 2_000;

export function looksAutomated(honeypot: string | null, elapsedMs: number | null): boolean {
  if (honeypot && honeypot.trim() !== "") return true;
  if (elapsedMs !== null && elapsedMs >= 0 && elapsedMs < MIN_FORM_FILL_MS) return true;
  return false;
}
