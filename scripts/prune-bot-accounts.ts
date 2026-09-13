// Removes registered accounts that never did anything.
//
// Between 2026-07-31 and 2026-09-12 the site accumulated 146 accounts and 7 of
// them had any footprint at all. The rest were created by an automated
// registration run exploiting the Gmail alias trick — see
// prisma/migrations/20260912160000_email_canonical_generated and
// lib/email-identity.ts, which closed the hole. This clears what got in before
// the door was shut.
//
// SAFETY — deleting a person's account is not recoverable, so the rule is
// narrow and the burden of proof is on deletion, never on keeping:
//
//   - ZERO footprint on every relation a user can touch: listings, messages
//     sent or received, reviews, claims, saved listings, reports filed,
//     businesses owned, boost payments, and any linked OAuth account. One row
//     anywhere and the account stays, whatever it looks like.
//   - Never an address on PROTECTED below, even with zero footprint. The
//     owner's own accounts are mostly empty and must survive.
//   - Never an account newer than MIN_AGE_HOURS, so somebody who signed up
//     minutes ago and has not clicked anything yet is not swept away.
//
// A name that "looks like a bot" is deliberately NOT a criterion. Real people
// have odd addresses, and the dot-pattern heuristic that identified this run
// would also match a real person who happens to type their address that way.
// Inactivity is the evidence; the pattern is only how it was noticed.
//
// Usage — dry run is the default and prints exactly what would go:
//   npx tsx scripts/prune-bot-accounts.ts
//   npx tsx scripts/prune-bot-accounts.ts --confirm

import "dotenv/config";
import { db } from "@/lib/db";

/** Never deleted, whatever their state. The owner's own accounts, including
 *  the admin address, which is legitimately empty. */
const PROTECTED = new Set(
  [
    "admin@gtasearch.com",
    "buruf@yahoo.com",
    "buruf1@gmail.com",
    "buruf@hotmail.com",
    "abdul.kahie@yahoo.com",
    process.env.ADMIN_EMAIL ?? "",
  ]
    .filter(Boolean)
    .map((e) => e.toLowerCase()),
);

/** Somebody who registered in the last day may simply not have acted yet. */
const MIN_AGE_HOURS = 24;

async function main() {
  const confirm = process.argv.includes("--confirm");
  console.log(`Bot-account prune — ${confirm ? "LIVE" : "DRY RUN"}\n`);

  const cutoff = new Date(Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000);

  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      createdAt: true,
      accounts: { select: { provider: true } },
      _count: {
        select: {
          listings: true,
          sentMessages: true,
          receivedMessages: true,
          reviews: true,
          businessClaims: true,
          claimsReviewed: true,
          savedListings: true,
          reportsFiled: true,
          ownedBusinesses: true,
          boostPayments: true,
          buyerConversations: true,
          sellerConversations: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const footprint = (u: (typeof users)[number]) =>
    Object.values(u._count).reduce((a, b) => a + b, 0) + u.accounts.length;

  const keepProtected: string[] = [];
  const keepActive: string[] = [];
  const keepRecent: string[] = [];
  const doomed: { id: string; email: string; createdAt: Date }[] = [];

  for (const u of users) {
    if (PROTECTED.has(u.email.toLowerCase())) {
      keepProtected.push(u.email);
    } else if (footprint(u) > 0) {
      keepActive.push(u.email);
    } else if (u.createdAt > cutoff) {
      keepRecent.push(u.email);
    } else {
      doomed.push({ id: u.id, email: u.email, createdAt: u.createdAt });
    }
  }

  console.log(`total accounts:            ${users.length}`);
  console.log(`kept — protected address:  ${keepProtected.length}  ${keepProtected.join(", ")}`);
  console.log(`kept — has a footprint:    ${keepActive.length}  ${keepActive.join(", ")}`);
  console.log(`kept — under ${MIN_AGE_HOURS}h old:     ${keepRecent.length}${keepRecent.length ? "  " + keepRecent.join(", ") : ""}`);
  console.log(`\nTO DELETE:                 ${doomed.length}`);
  for (const d of doomed.slice(0, 15)) {
    console.log(`   ${d.createdAt.toISOString().slice(0, 10)}  ${d.email}`);
  }
  if (doomed.length > 15) console.log(`   … and ${doomed.length - 15} more`);

  if (!confirm) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --confirm to apply.");
    await db.$disconnect();
    return;
  }
  if (doomed.length === 0) {
    console.log("\nNothing to do.");
    await db.$disconnect();
    return;
  }

  // Deleted in one statement; every dependent row cascades (schema.prisma sets
  // onDelete: Cascade on each relation, and Report.reporterId / Business
  // .claimedById are SetNull — but no doomed account holds either, because
  // holding one would have counted as a footprint).
  const { count } = await db.user.deleteMany({ where: { id: { in: doomed.map((d) => d.id) } } });
  console.log(`\ndeleted ${count} accounts`);
  console.log(`remaining: ${await db.user.count()}`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error("Prune failed:", err);
  process.exit(1);
});
