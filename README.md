# GTASearch

Classifieds for the Greater Toronto Area. Next.js 14 (App Router), TypeScript,
Tailwind, Prisma, PostgreSQL on Supabase.

**Phase 1: the public marketplace** — schema, seed, homepage, search,
listing detail, sitemap. Read-only, no accounts.
Design spec: `docs/superpowers/specs/2026-07-28-gtasearch-phase1-design.md`.

**Phase 2 (current): accounts, posting and dashboard** — NextAuth sign
up/in, the multi-step post-ad flow (details, location, photos, review),
listing edit/ownership, and the seller dashboard. Done and verified end to
end (tests, types, production build).

**Phase 3 (next):** Stripe boosts, messaging, email notifications,
favourites.

## Setup

```bash
npm install
cp .env.example .env    # then fill in DATABASE_URL and DIRECT_URL
npm run db:deploy       # apply migrations
npm run db:seed         # 5 users, 50 listings
npm run dev
```

`.env` needs both Supabase connection strings: the **transaction pooler**
(port 6543) as `DATABASE_URL`, and the **session pooler** (port 5432) as
`DIRECT_URL`. Get both from the Supabase dashboard's **Connect** button, under
ORMs → Prisma.

If your database password contains `@ : / ? # &`, percent-encode it (`@` becomes
`%40`) or the connection string will not parse.

`NEXTAUTH_SECRET` and `NEXTAUTH_URL` are **required** for Phase 2 (accounts,
posting, dashboard) — see `.env.example` for how to generate the secret.
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Google sign-in), `CLOUDINARY_*`
(image upload) and `RESEND_API_KEY`/`EMAIL_FROM` (transactional email) are all
**optional**: the app degrades gracefully without them (Google sign-in hidden,
photo uploads disabled with a message, emails skipped) rather than failing to
build or run. Full list and format in `.env.example`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Vitest suite (integration tests need a seeded database) |
| `npm run db:migrate` | Generate a migration **without applying it** |
| `npm run db:deploy` | Apply pending migrations |
| `npm run db:seed` | Reset and reseed |
| `npm run db:studio` | Prisma Studio |

## Gotchas

**Never run `prisma migrate dev`.** It hangs indefinitely against Supabase: it
tries to create a shadow database for drift detection and the pooler user has no
permission to do so. Generate with `npm run db:migrate` (`--create-only`), then
apply with `npm run db:deploy`. `npm run db:reset` will wipe all data.

**Do not run `npm run build` while the dev server is running.** They share
`.next`, and the build deletes chunks the dev server still needs, producing
`Cannot find module './948.js'`. Stop the dev server first, or delete `.next`
and restart afterwards.

**Keep this repository out of OneDrive.** It lives at
`C:\Users\buruf\Documents\gtasearch`, which is deliberately *not* the
OneDrive-redirected Documents folder (Windows repoints `Documents` at
`C:\Users\buruf\OneDrive\Documents`). `node_modules` and `.next` are tens of
thousands of constantly churning files; syncing them is slow and turns build
artifacts into cloud placeholders, which breaks Next's recursive delete with
`EINVAL: invalid argument, readlink '.next/types/package.json'`. If you ever hit
that, delete `.next` manually. Back this project up with git, not file sync.

## Architecture notes

Every page is a React Server Component querying Prisma directly — no API routes
for page data, no client-side fetching. This is what makes the homepage, search
and listing pages work with JavaScript disabled, which the SEO requirement
demands. The only API route is the view counter.

`lib/search.ts` is the only module using raw SQL, because Prisma cannot express
`tsvector` matching, `ts_rank` ordering, trigram operators, or the effective
boost expression. Everything else uses the query builder.

Search runs ranked full-text first and falls back to trigram matching below five
hits, so misspellings still return results. The trigram threshold (0.45) was
measured rather than guessed — see the spec for the calibration table.

Result ordering uses *effective* boost, which checks `boostExpiresAt` rather than
trusting `boostLevel`. Boosts are downgraded by a nightly cron in Phase 3, so
between a boost lapsing and that job running, a stale `boostLevel` would
otherwise keep an expired boost at the top of results.

`postalCode` is stored but never sent to the client. Listing queries use explicit
`select` clauses that omit it, and a test asserts this while also confirming
postal codes are actually populated, so it cannot pass trivially.

Auth: NextAuth v4, JWT sessions; all mutation logic in `lib/manage.ts` /
`lib/draft.ts` / `lib/users.ts` with ownership enforced server-side
(`ownedListing`) on every mutation.
