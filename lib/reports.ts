import { db } from "@/lib/db";

/** Stores a report. Signed-in reporters are deduped per listing (their second
 *  report is acknowledged but not stored); anonymous reports are always
 *  stored — IP-level abuse is the rate limiter's job, not the database's. */
export async function createReport(
  reporterId: string | null,
  listingId: string,
  reason: string,
  details: string,
): Promise<{ ok: true; duplicate: boolean }> {
  if (reporterId) {
    const existing = await db.report.findFirst({
      where: { listingId, reporterId },
      select: { id: true },
    });
    if (existing) return { ok: true, duplicate: true };
  }
  await db.report.create({
    data: { listingId, reporterId, reason, details: details || null },
  });
  return { ok: true, duplicate: false };
}
