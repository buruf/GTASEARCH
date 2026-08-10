# Halton outreach — Oakville, Burlington, Milton, Halton Hills

**Why this exists:** Halton is the only GTA region with no usable open business
data. Verified Aug 3 2026: the regional Hub portal publishes zero datasets;
halton.ca has no open-data section; Oakville's GIS org publishes 258 layers
(zoning, permits, elections — no businesses); Burlington's only business layers
are 2020 COVID-response data with no stated licence; Ontario's province-wide
"PHU food service premises" set is a 20+-location chain list, not a premises
list. Peel, York and Durham all run economic-development business directories.
Halton does not.

So the only honest routes into Oakville and Burlington are **asking** and
**owner claiming**. Send from Abdulkadir — it should come from the founder.

**Figures below are current as of Aug 5 2026: 55,318 businesses, 20 GTA
municipalities, 11 categories.** Twenty is municipalities, not city rows —
the database also splits Toronto into Scarborough, North York and Etobicoke,
which are districts of Toronto and must not be counted as separate towns to
anyone who would know better. Re-check with `npx tsx scripts/directory-stats.ts`
before sending if time has passed; a stale number in a cold email is the kind
of thing a records officer notices.

---

## Email A — municipal economic development

**To:** economic development, Town of Oakville / City of Burlington / Town of
Milton / Town of Halton Hills (and Halton Region)

**Subject:** GTASearch — Halton business listings, and a free claim campaign for local businesses

Hello,

I run GTASearch (www.gtasearch.com), a free local directory for the Greater
Toronto Area. It currently lists 55,318 businesses across 20 GTA
municipalities, built entirely from municipal open data — Toronto's business
licences and public-health registers, and the business directories published by
Peel Region, York Region and Durham Region. Every source and its licence is
credited publicly at www.gtasearch.com/data-sources.

Halton is the one region I can't cover, because I can't find an equivalent
public dataset. I'm writing with two questions:

1. Does your economic development office maintain a business directory or
   business register that could be shared for reuse — and if so, under what
   terms? York and Durham publish theirs under open licences, and Mississauga
   and Brampton under their own terms of use; I'm happy to work within whatever
   conditions you set, and to credit Halton the same way I credit the others.

2. Separately, and regardless of the answer to the first: I'd like to offer
   local businesses a free "claim your listing" campaign. Claiming costs
   nothing, lets an owner correct their own details, add photos and hours, and
   shows a verified badge. If it's useful to you, I'm glad to provide copy you
   could share with your business community.

I'm not looking to charge anyone for accuracy — correcting a listing is free
and always will be. There's an optional paid plan, but nothing about keeping a
listing correct sits behind it.

Happy to answer any questions about how the data is sourced or handled.

Abdulkadir Kahie
GTASearch — www.gtasearch.com
support@gtasearch.com

---

## Email B — chambers of commerce (Oakville, Burlington, Milton, Halton Hills)

**Subject:** Free claim-your-listing offer for your members — GTASearch

Hello,

I run GTASearch (www.gtasearch.com), a free local directory covering the
Greater Toronto Area. It lists 55,318 businesses across 20 municipalities,
built from municipal open data, with every source credited at
www.gtasearch.com/data-sources.

I want to be upfront: I'm not asking to copy your member directory. Your
members pay for that listing and it's yours.

What I'd like to offer instead is a free benefit you can pass on. Any business
can claim its GTASearch listing at no cost — correct the details, add photos
and hours, and show a verified badge. If that's useful to your members, I'm
happy to write a short blurb for your newsletter, and to prioritise reviewing
claims that come from your members so they're not waiting.

If Halton businesses would also benefit from being listed in the first place —
we currently have very little Halton coverage, for the reasons above — I'd
welcome a conversation about how to do that with your members' consent rather
than without it.

Abdulkadir Kahie
GTASearch — www.gtasearch.com
support@gtasearch.com

---

## Do not

- **Do not scrape** business.haltonhillschamber.on.ca (Chamber of Commerce,
  "All Rights Reserved", GrowthZone platform, paid member benefit) or
  haltonontario.ca (a CityBiz Media commercial directory — a direct
  competitor, "All Rights Reserved", paid memberships). Both were reviewed and
  rejected Aug 3 2026.
- **Do not import** Burlington's COVID-era layers (Food_Businesses 167 rows
  with `Status:"Closed"` and curbside/delivery flags, Supermarkets 31, Hotels
  16 with bed-occupancy). Six years stale, no licence, and would put closed
  restaurants in front of people looking for somewhere open.
