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
  try {
    await db.report.create({
      data: { listingId, reporterId, reason, details: details || null },
    });
  } catch (e) {
    // Partial unique index Report_one_per_reporter: a concurrent duplicate
    // from the same signed-in reporter lost the race — same outcome as the
    // findFirst check, acknowledged identically.
    if ((e as { code?: string }).code === "P2002") return { ok: true, duplicate: true };
    throw e;
  }
  return { ok: true, duplicate: false };
}
