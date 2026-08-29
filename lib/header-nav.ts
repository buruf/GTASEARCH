/**
 * Which half of the site a path belongs to.
 *
 * GTASearch is two products in one shell: the business directory, which is now
 * the homepage and the default, and the classifieds at /classifieds. This is
 * the single place that decides which one you are in, used by both the header's
 * cross-section link and the header's search box.
 *
 * The direction matters and was originally backwards. After the homepage flip
 * the directory became the default, but the header still treated it as the
 * exception — so on /near-me, /events or /about the search box submitted to the
 * classifieds index. Searching "halal food" there returned nothing, because
 * the site has one classified listing, while the directory holds 55 matching
 * businesses. Classifieds is the exception now; everything else is directory.
 */
const CLASSIFIEDS_PREFIXES = ["/classifieds", "/search", "/listing", "/post-ad", "/saved"];

export function isClassifiedsPath(pathname: string): boolean {
  return CLASSIFIEDS_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The header link always leads to the section you are NOT in.
 *
 * usePathname() never returns the query string, so "/search?q=sofa" arrives
 * here as "/search"; matching the bare path is correct.
 */
export function sectionLinkFor(pathname: string): { href: string; label: string } {
  return isClassifiedsPath(pathname)
    ? { href: "/", label: "Businesses" }
    : { href: "/classifieds", label: "Classifieds" };
}
