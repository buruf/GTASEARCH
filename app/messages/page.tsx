import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { requireUserId } from "@/lib/auth";
import { listConversations } from "@/lib/messages";
import { formatRelativeTime, formatUnreadCount, truncateSnippet } from "@/lib/format";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default async function MessagesPage() {
  const userId = await requireUserId();
  const rows = await listConversations(userId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-ink">Messages</h1>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-card border border-line bg-surface-alt px-6 py-12 text-center">
          <p className="font-semibold text-ink">No conversations yet</p>
          <p className="mt-2 text-sm text-ink-muted">
            Find something you like and message the seller — replies land here.
          </p>
          <Link href="/search" className="mt-4 inline-block rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
            Browse listings
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
          {rows.map((c) => {
            const badge = formatUnreadCount(c.unread);
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-alt">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-btn bg-surface-alt">
                    {c.listing.images[0] && (
                      <Image src={c.listing.images[0]} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${badge ? "font-bold text-ink" : "font-medium text-ink"}`}>
                      {c.otherName}
                      <span className="font-normal text-ink-muted"> · {c.listing.title}</span>
                    </p>
                    <p className="truncate text-sm text-ink-muted">
                      {c.lastMessage ? truncateSnippet(c.lastMessage.content, 80) : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <time className="text-xs text-ink-faint">{formatRelativeTime(c.updatedAt)}</time>
                    {badge && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{badge}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
