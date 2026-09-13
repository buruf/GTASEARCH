import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { isVerified } from "@/lib/email-verification";
import { DirectoryPagination } from "@/app/directory/_components/DirectoryPagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * Who has an account, and what they have actually done.
 *
 * The console could moderate listings, reports, claims and reviews but never
 * showed the PEOPLE behind them, so the September registration run — 131
 * accounts in eight days, the site's entire user base — was invisible from
 * inside the admin console. It was found by querying the database directly.
 *
 * The footprint column is the thing worth looking at: an account with nothing
 * against it is either brand new or was never a person. That single number is
 * what the 2026-09-13 prune sorted on, and having it on screen means the next
 * run is noticed on the day rather than after a month.
 *
 * Read-only. Deleting an account is not a button — it cascades through
 * listings, messages, reviews and claims, and a mis-click is unrecoverable.
 * That stays in scripts/prune-bot-accounts.ts, which shows exactly what it
 * would remove before it removes anything.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  await requireAdmin();

  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);

  // Matches the address as typed OR the mailbox it resolves to, so searching
  // "kleanologyforyou@gmail.com" finds the dotted aliases too.
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { emailCanonical: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, email: true, emailCanonical: true, name: true,
        createdAt: true, emailVerified: true,
        accounts: { select: { provider: true } },
        _count: {
          select: {
            listings: true, sentMessages: true, reviews: true,
            businessClaims: true, ownedBusinesses: true, savedListings: true,
          },
        },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const buildHref = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  const cell = "px-3 py-2 align-top text-sm";

  return (
    <div>
      <h2 className="text-lg font-bold text-ink">
        Users{total > 0 && ` (${total.toLocaleString("en-CA")})`}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Newest first. &ldquo;Did&rdquo; counts everything an account has ever
        created — an empty one is either brand new or was never a person.
      </p>

      <form action="/admin/users" method="GET" className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name or email…"
          className="h-10 min-w-0 flex-1 rounded-btn border border-line px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand"
        />
        <button
          type="submit"
          className="h-10 rounded-btn bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Search
        </button>
        {q && (
          <Link
            href="/admin/users"
            className="flex h-10 items-center rounded-btn border border-line px-4 text-sm font-medium text-ink hover:border-brand hover:text-brand"
          >
            Clear
          </Link>
        )}
      </form>

      {users.length === 0 ? (
        <p className="mt-6 rounded-card border border-line bg-surface-alt p-6 text-sm text-ink-muted">
          {q ? `Nobody matches “${q}”.` : "No accounts yet."}
        </p>
      ) : (
        // Scrolls inside itself rather than pushing the page sideways.
        <div className="mt-4 overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[44rem] border-collapse">
            <thead className="bg-surface-alt">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <th className={cell}>Account</th>
                <th className={cell}>Joined</th>
                <th className={cell}>Confirmed</th>
                <th className={cell}>Did</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const did = Object.entries(u._count).filter(([, n]) => n > 0);
                const footprint = did.reduce((a, [, n]) => a + n, 0);
                return (
                  <tr key={u.id} className="border-t border-line align-top">
                    <td className={cell}>
                      <div className="font-medium text-ink">{u.name}</div>
                      <div className="text-ink-muted">{u.email}</div>
                      {/* Only when it differs, so the column stays quiet for
                          the ordinary case and shouts for an alias. */}
                      {u.emailCanonical && u.emailCanonical !== u.email.toLowerCase() && (
                        <div className="text-xs text-ink-faint">
                          inbox: {u.emailCanonical}
                        </div>
                      )}
                      {u.accounts.length > 0 && (
                        <div className="text-xs text-ink-faint">
                          via {u.accounts.map((a) => a.provider).join(", ")}
                        </div>
                      )}
                    </td>
                    <td className={`${cell} whitespace-nowrap text-ink-muted`}>
                      {u.createdAt.toLocaleDateString("en-CA")}
                    </td>
                    <td className={`${cell} whitespace-nowrap`}>
                      {u.emailVerified ? (
                        <span className="text-ink-muted">Yes</span>
                      ) : isVerified(u) ? (
                        // Registered before verification existed, so the gate
                        // lets them through. Say so rather than showing "No"
                        // beside an account that is not actually blocked.
                        <span className="text-ink-faint">Pre-dates</span>
                      ) : (
                        <span className="font-medium text-amber-700">No</span>
                      )}
                    </td>
                    <td className={cell}>
                      {footprint === 0 ? (
                        <span className="text-ink-faint">nothing</span>
                      ) : (
                        <span className="text-ink-muted">
                          {did.map(([k, n]) => `${n} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`).join(", ")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <DirectoryPagination page={page} totalPages={totalPages} buildHref={buildHref} />
      )}
    </div>
  );
}
