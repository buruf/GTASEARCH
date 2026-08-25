/**
 * Which way the header's cross-section link points.
 *
 * The site is two products sharing one shell: the business directory at `/`
 * and the classifieds at `/classifieds`. The link must always lead to the
 * section you are NOT in.
 *
 * This lives in lib rather than in the component so it can be unit-tested.
 * The bug it replaces was a hardcoded href — once you were inside the
 * classifieds the link pointed at the page you were already on, leaving the
 * logo as the only way back to the directory, and the logo does not say where
 * it goes. No test could have caught that; only clicking through would have.
 */
const CLASSIFIEDS_PREFIXES = ["/classifieds", "/search", "/listing", "/post-ad", "/saved"];

/**
 * usePathname() never includes the query string, so "/search?q=sofa" arrives
 * here as "/search" — matching the bare path is correct.
 */
export function sectionLinkFor(pathname: string): { href: string; label: string } {
  const inClassifieds = CLASSIFIEDS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  return inClassifieds
    ? { href: "/", label: "Businesses" }
    : { href: "/classifieds", label: "Classifieds" };
}
