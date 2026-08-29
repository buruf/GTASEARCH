-- Phase 5D: deals and coupons.
--
-- HAND-EDITED. `prisma migrate diff` again proposed dropping the hand-built
-- search indexes and the generated tsvector defaults; all of that is OMITTED.
-- Prisma cannot express them, so it reports them as drift on every migration,
-- and applying it would silently break search across the site.

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "code" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_status_endsAt_idx" ON "Deal"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Deal_businessId_status_idx" ON "Deal"("businessId", "status");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: a deal cannot end before it starts. Prisma cannot express a
-- CHECK, and these dates come from a form — the one place a nonsensical range
-- is most likely to arrive.
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_dates_ordered" CHECK ("endsAt" > "startsAt");
