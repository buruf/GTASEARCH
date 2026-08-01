import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { CITIES } from "@/lib/cities";
import { BUSINESS_CATEGORIES } from "@/lib/business-categories";

const POPULAR_SEARCHES = [
  { label: "Sofas in Toronto", href: "/search?q=sofa&city=toronto" },
  { label: "Used cars", href: "/search?category=cars-vehicles" },
  { label: "Apartments for rent", href: "/search?category=real-estate" },
  { label: "iPhones", href: "/search?q=iphone&category=electronics" },
  { label: "Free stuff", href: "/search?category=free-stuff" },
  { label: "Jobs in Mississauga", href: "/search?category=jobs&city=mississauga" },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-line bg-surface-alt">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">GTASearch</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li><Link href="/about" className="hover:text-brand">About</Link></li>
              <li><Link href="/contact" className="hover:text-brand">Contact</Link></li>
              <li><Link href="/terms" className="hover:text-brand">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-brand">Privacy</Link></li>
              <li><Link href="/post-ad" className="hover:text-brand">Post Ad</Link></li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Categories</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {CATEGORIES.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/search?category=${c.slug}`} className="hover:text-brand">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Directory</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {BUSINESS_CATEGORIES.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/directory/${c.slug}`} className="hover:text-brand">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Cities</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {CITIES.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/search?city=${c.slug}`} className="hover:text-brand">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Popular searches</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              {POPULAR_SEARCHES.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="hover:text-brand">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 border-t border-line pt-6 text-xs text-ink-muted">
          © {new Date().getFullYear()} GTASearch. Serving the Greater Toronto
          Area. All prices in Canadian dollars.
        </p>
      </div>
    </footer>
  );
}
