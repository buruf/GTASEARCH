// Retro-applies the personal-name privacy gate to businesses already imported.
//
// The gate was added after the Mississauga, Brampton and York batches had
// already been written, when a Durham record turned out to be a registered
// massage therapist listed by her own name at her own house. Anything already
// published that fails the same test is hidden here rather than left up.
//
// Hides rather than deletes: status "hidden" removes a row from every public
// surface (browse, search, sitemap, profile) while keeping it recoverable if a
// listing turns out to be a genuine storefront that simply lacks a website.
//
// Usage: npx tsx scripts/hide-personal-name-listings.ts [--apply]
//        Default is a dry run that only reports.

import "dotenv/config";
import { db } from "@/lib/db";
import {
  PREMISES_CATEGORIES,
  hasUnitDesignator,
  looksLikePersonalName,
  looksResidential,
} from "./naics-mapping";

async function main() {
  const apply = process.argv.includes("--apply");

  // Scoped to the regional business directories only. The Toronto rows come
  // from licence and public-health INSPECTION feeds — a BodySafe premises is
  // one a health inspector physically visited, which is direct evidence of a
  // commercial location, so a personal-sounding name there ("Roxanne Muir")
  // is a salon, not somebody's living room. The regional directories are
  // self-registration lists with no such check, which is where the hazard is.
  const rows = await db.business.findMany({
    where: {
      source: "open-data",
      status: "active",
      description: { contains: "Business Directory" },
    },
    select: { id: true, slug: true, name: true, category: true, address: true, website: true, city: true },
  });
  console.log(`scanning ${rows.length} regional-directory businesses…\n`);

  // The importer also credits an employee count as a commercial signal, but
  // that field is not persisted on the row, so this pass can only use the
  // website, the unit designator and the street type. Slightly stricter than
  // the importer — the right direction to err for a privacy check.
  const flagged = rows.filter(
    (r) =>
      !PREMISES_CATEGORIES.has(r.category) &&
      looksLikePersonalName(r.name) &&
      (!((r.website && r.website.trim().length > 3) || hasUnitDesignator(r.address)) ||
        looksResidential(r.address)),
  );

  const byCategory = new Map<string, number>();
  for (const r of flagged) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);

  console.log(`flagged ${flagged.length} listings:`);
  for (const [c, n] of [...byCategory].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${c}`);
  }
  console.log("\nsample:");
  for (const r of flagged.slice(0, 20)) {
    console.log(`  ${r.name} — ${r.category} — ${r.address}, ${r.city}`);
  }

  if (!apply) {
    console.log("\nDRY RUN — nothing changed. Re-run with --apply to hide these.");
    return;
  }

  const ids = flagged.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    await db.business.updateMany({ where: { id: { in: chunk } }, data: { status: "hidden" } });
    process.stderr.write(`\r  hidden ${Math.min(i + 500, ids.length)}/${ids.length}`);
  }
  if (ids.length) process.stderr.write("\n");
  console.log(`\nHidden ${ids.length} listings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
