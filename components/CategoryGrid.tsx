import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";

export function CategoryGrid({ counts }: { counts: Record<string, number> }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {CATEGORIES.map((c) => {
        const count = counts[c.slug] ?? 0;
        return (
          <li key={c.slug}>
            <Link
              href={`/search?category=${c.slug}`}
              className="flex h-full flex-col items-center gap-2 rounded-card border border-line bg-surface p-3 text-center transition-colors hover:border-brand hover:bg-brand-50"
            >
              <span className="text-brand">
                <CategoryIcon name={c.icon} className="h-7 w-7" />
              </span>
              <span className="text-xs font-medium leading-tight text-ink sm:text-sm">
                {c.label}
              </span>
              <span className="mt-auto text-[11px] text-ink-faint">
                {count} {count === 1 ? "ad" : "ads"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
