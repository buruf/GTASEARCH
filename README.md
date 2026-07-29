# GTASearch

Classifieds for the Greater Toronto Area. Next.js 14 (App Router), TypeScript,
Tailwind, Prisma, PostgreSQL on Supabase.

**Phase 1 (current): the public marketplace** — schema, seed, homepage, search,
listing detail, sitemap. Read-only, no accounts.
Design spec: `docs/superpowers/specs/2026-07-28-gtasearch-phase1-design.md`.

Phase 2 adds accounts, posting and image upload. Phase 3 adds Stripe boosts,
messaging and email.

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

**OneDrive.** This repository currently lives inside a OneDrive folder. Cloud
placeholder files break Next's recursive delete with
`EINVAL: invalid argument, readlink '.next/types/package.json'`. If that
happens, delete `.next` manually. Moving the repository outside OneDrive avoids
the problem entirely and makes development noticeably faster.

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
