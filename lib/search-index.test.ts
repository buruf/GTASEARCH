import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";

/**
 * The Business searchVector is a generated column, so the category labels it
 * indexes live as a static CASE inside a migration. A migration cannot import
 * TypeScript, which means the taxonomy and the search index can silently drift:
 * add a category, forget the migration, and every business in it becomes
 * unfindable by its category name with nothing failing.
 *
 * This is the tripwire for that. It reads the migration that owns the CASE and
 * asserts every current category appears in it.
 */
const MIGRATIONS = join(process.cwd(), "prisma", "migrations");

function latestSearchVectorMigration(): string {
  // The most recent migration that redefines the Business searchVector owns
  // the current definition.
  const dirs = readdirSync(MIGRATIONS).filter((d) => /^\d/.test(d)).sort();
  let found: string | null = null;
  for (const d of dirs) {
    let sql: string;
    try {
      sql = readFileSync(join(MIGRATIONS, d, "migration.sql"), "utf8");
    } catch {
      continue;
    }
    if (sql.includes('"searchVector" tsvector GENERATED ALWAYS AS') && sql.includes('"Business"')) {
      found = sql;
    }
  }
  if (!found) throw new Error("No migration defines the Business searchVector");
  return found;
}

describe("business search index", () => {
  it("indexes the label of every category in the taxonomy", () => {
    const sql = latestSearchVectorMigration();
    for (const c of BUSINESS_CATEGORIES) {
      expect(sql, `category "${c.slug}" is missing from the searchVector CASE`).toContain(
        `WHEN '${c.slug}' THEN`,
      );
      // The label matters as much as the slug: it is the text people type.
      // Apostrophes would be SQL-escaped, so only assert on labels without one.
      if (!c.label.includes("'")) {
        expect(sql, `label "${c.label}" is missing from the searchVector CASE`).toContain(
          `'${c.label}'`,
        );
      }
    }
  });

  it("weights the category below the name and description", () => {
    const sql = latestSearchVectorMigration();
    // A business actually called "Halal Meat" must outrank one that merely
    // happens to be a restaurant.
    expect(sql).toMatch(/setweight\(to_tsvector\('english', coalesce\("name", ''\)\), 'A'\)/);
    expect(sql).toMatch(/'C'\)/);
  });

  it("includes the subcategory with hyphens split into words", () => {
    const sql = latestSearchVectorMigration();
    // "hair-salons" must tokenise as "hair" and "salon", not one odd token.
    expect(sql).toContain(`replace(coalesce("subcategory", ''), '-', ' ')`);
  });
});
