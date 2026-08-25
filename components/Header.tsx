import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unreadCountFor } from "@/lib/messages";
import { Logo } from "@/components/Logo";
import { HeaderSearch } from "@/components/HeaderSearch";
import { HeaderSectionLink } from "@/components/HeaderSectionLink";
import { UserMenu } from "@/components/UserMenu";

export async function Header() {
  const session = await getServerSession(authOptions);
  const unread = session?.user ? await unreadCountFor(session.user.id) : 0;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16">
        <Link href="/" aria-label="GTASearch home" className="shrink-0">
          <Logo />
        </Link>

        <HeaderSearch variant="desktop" />

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/events"
            className="hidden rounded-btn px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink sm:block"
          >
            Events
          </Link>
          <HeaderSectionLink variant="desktop" />
          {session?.user ? (
            <UserMenu name={session.user.name ?? "Account"} unread={unread} />
          ) : (
            <Link
              href="/auth/signin"
              className="hidden rounded-btn px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink sm:block"
            >
              Sign In
            </Link>
          )}
          <Link
            href="/post-ad"
            className="rounded-btn bg-brand px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark sm:px-4"
          >
            Post Ad
          </Link>
        </div>
      </div>

      {/* On mobile the search bar drops to its own row so the logo and CTA keep
          their space. The section link rides along here too, compact, since
          the desktop copy above is hidden at this breakpoint. */}
      <div className="flex items-center gap-2 border-t border-line px-4 py-2 sm:hidden">
        <HeaderSearch variant="mobile" />
        <HeaderSectionLink variant="mobile" />
      </div>
    </header>
  );
}
