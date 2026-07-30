"use server";

import { headers } from "next/headers";
import { currentUserId } from "@/lib/auth";
import { getPublicListing } from "@/lib/listing";
import { createReport } from "@/lib/reports";
import { ReportSchema, REPORT_REASONS } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { sendReportEmail } from "@/lib/email";
import { adminEmail } from "@/lib/env";
import type { FormState } from "@/app/auth/actions";

export async function submitReportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`report:${ip}`, 5, 24 * 60 * 60 * 1000)) {
    return { ok: false, error: "Too many reports today. Try again tomorrow." };
  }

  const listingId = String(formData.get("listingId") ?? "");
  const listing = await getPublicListing(listingId);
  if (!listing) return { ok: false, error: "This listing no longer exists." };

  const parsed = ReportSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const reporterId = await currentUserId();
  const { duplicate } = await createReport(reporterId, listingId, parsed.data.reason, parsed.data.details);

  if (!duplicate) {
    const to = adminEmail();
    if (to) {
      // Awaited, not fire-and-forget: on serverless (Vercel) the invocation
      // can be frozen the instant the response is sent, killing any
      // un-awaited work before it completes (see deliver() in
      // app/messages/actions.ts for the same pattern). The try/catch is
      // belt-and-braces — an email failure must never fail the report.
      try {
        await sendReportEmail(to, {
          listingId,
          listingTitle: listing.title,
          reason: REPORT_REASONS[parsed.data.reason] ?? parsed.data.reason,
          details: parsed.data.details,
        });
      } catch {
        /* email must never fail the report */
      }
    }
  }
  // Duplicate and fresh both land on the same thank-you: nothing to probe.
  return { ok: true };
}
