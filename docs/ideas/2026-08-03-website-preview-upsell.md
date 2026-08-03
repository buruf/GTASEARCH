# IDEA (PARKED) — Auto-generated website preview → paid site upsell

**Date parked:** 2026-08-03
**Status:** PARKED. Not approved, not scheduled, not designed. No code.
**Origin:** User noticed directory rows with no website (e.g. Konis Beauty
Salon, Beauty & Wellness, 945 Peter Robertson Blvd, Brampton, 905-793-1119)
and asked whether building sites on spec and pitching them is worth doing.
**Position in roadmap:** AFTER 5C reviews at the earliest. It is a revenue
experiment on top of shipped 5B claiming/Pro, not a directory feature.

---

## 1. The idea in one line

For directory businesses with `website = null`, auto-generate a personalised
one-page website preview from data GTASearch already holds, then pitch the
owner a hosted site as a paid monthly service.

## 2. Why this is worth parking rather than dropping

The directory is the asset that makes it viable, and no generic web freelancer
has it:

- **19,029 real GTA businesses**, already categorised, addressed and phoned.
- `Business.website` is nullable and populated only where a source disclosed
  one → **the prospect list is a single WHERE clause**, not a research project.
- The directory is a legitimate, non-spammy reason to make contact: the
  business is already listed, the profile is already public, the preview is an
  extension of a listing they can already claim for free.
- 5B already shipped claiming + Stripe subscriptions, so the billing rails,
  ownership model and owner-edit surface exist.

## 3. The honest risks (recorded so they are not rediscovered later)

1. **"No website" ≠ "wants a website."** Salons, barbers and trades often run
   entirely on Instagram, Google Business Profile, walk-ins and booking apps
   (Fresha, Booksy, Vagaro, Square). Many have already decided not to buy this.
2. **Spec building does not scale.** Hand-building full sites before a sale
   converts in the low single digits; 20 sites × 3 hours for one close is a bad
   trade. Only a *generated* preview makes the economics work.
3. **One-time sales are a treadmill.** The business is recurring monthly
   (hosting + edits + Google Business Profile upkeep), not $800 once.
4. **Focus cost.** This is a *services* business — sales calls, revisions,
   client support — which is a different workload from shipping code, and it
   competes with 5C/5D and the other projects.

## 4. Legal / ethical guardrails (Canada — non-negotiable if this ever runs)

- **CASL.** Cold *email* needs an exemption. B2B messages sent to a
  conspicuously published business address, about that business's activities,
  generally qualify — but must carry sender identity and a working unsubscribe.
  **Cold-calling a business is exempt from the CRTC DNCL**, so phone is the
  safer and probably higher-converting channel.
- **Never register a domain in the business's name** before they are a client.
  It reads as cybersquatting and kills the pitch.
- **No scraped logos or photos** in a preview. Own assets, stock, or nothing.
- **Preview pages must be `noindex`, visibly labelled a demo/mockup, and
  expire.** A page that looks like the business's real site, indexed by Google,
  is a liability — and it would compete with their own GBP listing.
- **Respect the existing privacy gates.** Regional-directory rows for
  home-registered sole proprietors are already excluded/hidden
  (`looksLikePersonalName`, HOME_BASED_RISK, premises evidence). Prospect
  queries must run over `status = "active"` rows ONLY, never the hidden set —
  cold-calling someone's home is not the same as calling a business.
- **No fabricated content on the preview.** Same rule the directory already
  holds for reviews: only facts the business actually published.

## 5. Validate before building anything

Cheapest possible test, and it costs one afternoon:

> Pull ~20 `website = null` active businesses across beauty / home-services /
> automotive in Brampton + Mississauga. **Call them.** Don't sell — ask:
> do you have a website, why not, how do new customers find you, would you pay
> ~$99/month to be found on Google and take bookings online?

Decision rule: **3+ genuine yes-signals out of 20 → design it. 0–1 → drop it
permanently and delete this file.** Record the actual call outcomes in this
doc before writing a single line of code.

## 6. Rough shape IF validated (sketch only — not a design)

- **Prospect query:** `Business.website = null AND status = "active"`, filtered
  by category and city; excludes claimed rows.
- **Generator:** one template rendering from existing fields — `name`,
  `description`, `category`/`subcategory`, `address`, `city`,
  `neighbourhood`, `phone`, `hours`, `images`. No new data collection.
- **Preview route:** e.g. `/preview/[slug]`, `noindex`, demo banner, expiring
  token, zero SEO surface. Must not be linked from the directory.
- **Product sold:** hosted one-page site + domain + edits + GBP upkeep, priced
  monthly, as a tier ABOVE the existing $19 Pro (`lib/plans.ts` is the single
  source of truth for plan facts — any new tier goes there, and the Stripe
  webhook stays the only writer of plan state).
- **Sales motion:** phone first, preview link second, directory listing as the
  credibility opener.

## 7. Explicitly NOT part of this

- Not part of 5C (reviews) or 5D (deals/events); do not let it slip into those.
- Does not change the directory's data rules, the free-claiming promise, or
  what Pro includes.
- No hand-built spec sites. Generated previews or nothing.

## 8. Open questions for when this is picked up

- Does the preview live on gtasearch.com or a separate agency-branded domain?
  (Directory neutrality argues for separate; credibility argues for same.)
- Who does the client support and revisions once there are 10+ site clients?
- Price point: $99/mo assumed above, never tested.
- Does selling websites to listed businesses compromise the directory's
  perceived neutrality? This is the real strategic question.
