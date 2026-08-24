# GTASearch — project notes for Claude

## Deploy
- The default branch is **`master`** (not main). Push to master auto-deploys www.gtasearch.com (Vercel, project `gtasearch`, team `eduyro-s-projects`).
- The build must keep `prisma generate && next build`.

## Email (migrated to Brevo, 2026-08-23)
- Transport: `lib/email.ts` — every notification mail goes through one internal `deliver()` which tries `BREVO_API_KEY` (Brevo REST) first, falls back to `RESEND_API_KEY`. All mails are plain text; the Brevo path wraps them in minimal HTML because Brevo requires `htmlContent`.
- Gate: `emailEnabled()` in `lib/env.ts` (renamed from `resendEnabled()`) — true when either provider key is set. Tests in `lib/env.test.ts`.
- Vercel production has `BREVO_API_KEY` + `EMAIL_FROM = GTASearch <noreply@gtasearch.com>` set and delivery is inbox-verified.
- `EMAIL_FROM` must stay on a Brevo-verified domain (gtasearch.com is verified). The shared Brevo account's API IP-blocking is disabled — required for Vercel; do not re-enable.
