-- Phase 5C: reviews.
--
-- HAND-EDITED. `prisma migrate diff` again proposed dropping the four
-- hand-built search indexes and the generated-column defaults:
--
--   DROP INDEX "Business_name_trgm_idx";
--   DROP INDEX "Business_searchVector_idx";
--   DROP INDEX "Listing_searchVector_idx";
--   DROP INDEX "Listing_title_trgm_idx";
--   ALTER TABLE "Business"/"Listing" ALTER COLUMN "searchVector" DROP DEFAULT;
--
-- All five are OMITTED. They are the GIN/trigram indexes and generated
-- tsvector columns behind full-text and fuzzy search; applying them would
-- silently break search across the site. Prisma cannot express them, so it
-- reports them as drift on every single migration. Never let them through.

-- AlterTable: denormalised review aggregates. Written only inside the same
-- transaction as the review that changes them (lib/reviews.ts).
ALTER TABLE "Business" ADD COLUMN     "ratingSum" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "ownerResponse" TEXT,
    "ownerRespondedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_businessId_status_createdAt_idx" ON "Review"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_businessId_userId_key" ON "Review"("businessId", "userId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: ratings are 1-5, enforced in the database and not only in Zod.
-- The application is not the last line of defence for a value that feeds a
-- public average — a bad write here would silently corrupt every rating shown.
-- Prisma cannot express CHECK constraints, so do not let a future diff drop it.
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Hand-written: the aggregates must stay internally consistent. A count can
-- never be negative, and the rating sum must be within the range those reviews
-- could possibly produce.
ALTER TABLE "Business" ADD CONSTRAINT "Business_review_aggregates_sane"
  CHECK ("reviewCount" >= 0 AND "ratingSum" >= 0 AND "ratingSum" <= "reviewCount" * 5);
