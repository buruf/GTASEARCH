-- Phase 5B: business claiming + Pro subscriptions.
--
-- HAND-EDITED, as every migration in this project must be. `prisma migrate
-- diff` proposed four destructive statements that are DELIBERATELY OMITTED
-- here, because Prisma cannot express them and therefore believes they are
-- drift:
--
--   DROP INDEX "Business_name_trgm_idx";
--   DROP INDEX "Business_searchVector_idx";
--   DROP INDEX "Listing_searchVector_idx";
--   DROP INDEX "Listing_title_trgm_idx";
--   ALTER TABLE "Business"/"Listing" ALTER COLUMN "searchVector" DROP DEFAULT;
--
-- Those are the GIN/trigram indexes and generated tsvector columns that make
-- search work. Applying them would silently destroy full-text and fuzzy
-- search across the whole site. Never let them into a migration.

-- AlterTable: subscription state on Business. The Stripe webhook is the only
-- writer of these columns.
ALTER TABLE "Business" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "planRenewsAt" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateTable
CREATE TABLE "BusinessClaim" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "roleAtBusiness" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessClaim_status_createdAt_idx" ON "BusinessClaim"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BusinessClaim_businessId_idx" ON "BusinessClaim"("businessId");

-- CreateIndex
CREATE INDEX "BusinessClaim_userId_idx" ON "BusinessClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Business_stripeSubscriptionId_key" ON "Business"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Business_claimedById_idx" ON "Business"("claimedById");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessClaim" ADD CONSTRAINT "BusinessClaim_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessClaim" ADD CONSTRAINT "BusinessClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessClaim" ADD CONSTRAINT "BusinessClaim_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written: one PENDING claim per person per business. Partial, so a
-- claimant whose first attempt was rejected can submit again with better
-- evidence instead of being locked out forever. Prisma cannot express a
-- partial unique index, so this is invisible to the schema file — do not let
-- a future `migrate diff` drop it.
CREATE UNIQUE INDEX "BusinessClaim_one_pending_per_user"
  ON "BusinessClaim" ("businessId", "userId")
  WHERE "status" = 'pending';
