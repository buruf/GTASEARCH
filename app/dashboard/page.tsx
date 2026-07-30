import Link from "next/link";
import type { Metadata } from "next";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { MyAdRow } from "./MyAdRow";
import { SettingsForms } from "./SettingsForms";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};

function DisabledTab({ label }: { label: string }) {
  return (
    <span
      title="Coming soon"
      aria-disabled="true"
      className="flex-1 cursor-not-allowed rounded-btn py-2 text-center text-sm font-semibold text-ink-faint"
    >
      {label}
    </span>
  );
}

export default async function DashboardPage() {
  const userId = await requireUserId();

  const [user, listings] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, phone: true } }),
    db.listing.findMany({
      where: { userId, status: { not: "deleted" } },
      select: {
        id: true, title: true, price: true, priceType: true, status: true,
        images: true, views: true, createdAt: true, expiresAt: true,
        category: true, description: true, city: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>

      <div className="mt-6 flex gap-1 rounded-btn bg-surface-alt p-1">
        <span className="flex-1 rounded-btn bg-brand py-2 text-center text-sm font-semibold text-white">
          My Ads
        </span>
        <DisabledTab label="Saved" />
        <DisabledTab label="Messages" />
      </div>

      <div className="mt-6 divide-y divide-line rounded-card border border-line bg-surface shadow-card">
        {listings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-ink-muted">You haven&apos;t posted any ads yet.</p>
            <Link
              href="/post-ad"
              className="mt-4 inline-block rounded-btn bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Post your first ad
            </Link>
          </div>
        ) : (
          listings.map((l) => <MyAdRow key={l.id} listing={l} />)
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold text-ink">Account settings</h2>
        <SettingsForms name={user?.name ?? ""} phone={user?.phone ?? ""} />
      </div>
    </div>
  );
}
