// SEO slugs for business profiles: kebab name + city, ASCII-folded.
// Collision suffixes (-2, -3…) are the importer's job — this stays pure.

export function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // fold accents: Café → Cafe
    .replace(/['']/g, "") // remove apostrophes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function makeBusinessSlug(name: string, citySlug: string): string {
  return `${slugifyName(name)}-${citySlug}`;
}
