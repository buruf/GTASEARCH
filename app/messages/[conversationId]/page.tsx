import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth";
import { getThread, markThreadRead } from "@/lib/messages";
import { formatRelativeTime } from "@/lib/format";
import { ReplyForm } from "./ReplyForm";

export const metadata: Metadata = { title: "Conversation", robots: { index: false } };

export default async function ThreadPage({ params }: { params: { conversationId: string } }) {
  const userId = await requireUserId();
  const thread = await getThread(userId, params.conversationId);
  if (!thread) notFound();

  // Viewing the thread is what "reading" means.
  await markThreadRead(userId, params.conversationId);

  const inactive = thread.listing.status !== "active" || thread.listing.expiresAt <= new Date();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/messages" className="text-sm text-brand hover:underline">← All messages</Link>

      <div className="mt-3 rounded-card border border-line bg-surface p-3">
        <p className="text-sm text-ink-muted">
          Conversation with <strong className="text-ink">{thread.otherName}</strong> about{" "}
          <Link href={`/listing/${thread.listing.id}`} className="font-medium text-brand hover:underline">
            {thread.listing.title}
          </Link>
        </p>
      </div>

      {inactive && (
        <p className="mt-3 rounded-card bg-surface-alt px-4 py-2.5 text-sm text-ink-muted">
          This listing is no longer active. You can still reply to coordinate.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {thread.messages.map((m) => {
          const mine = m.senderId === userId;
          return (
            <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[80%] rounded-card px-3 py-2 ${mine ? "bg-brand text-white" : "bg-surface-alt text-ink"}`}>
                <p className="whitespace-pre-line break-words text-sm">{m.content}</p>
                <time className={`mt-1 block text-right text-[11px] ${mine ? "text-white/70" : "text-ink-faint"}`}>
                  {formatRelativeTime(m.createdAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4">
        <ReplyForm conversationId={thread.id} />
      </div>
    </div>
  );
}
