-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "expiryReminderAt" TIMESTAMP(3);

-- One report per signed-in reporter per listing, enforced at the database.
-- Partial: anonymous reports (reporterId NULL) are never deduped.
-- Prisma cannot express partial indexes; hand-written (see Phase 2 precedent).
CREATE UNIQUE INDEX "Report_one_per_reporter"
  ON "Report"("listingId", "reporterId") WHERE "reporterId" IS NOT NULL;
