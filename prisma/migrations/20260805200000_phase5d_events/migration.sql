-- Phase 5D: local events.
--
-- HAND-EDITED, as every migration here must be. `prisma migrate diff` again
-- proposed dropping the four hand-built search indexes and the generated
-- tsvector column defaults:
--
--   DROP INDEX "Business_name_trgm_idx";
--   DROP INDEX "Business_searchVector_idx";
--   DROP INDEX "Listing_searchVector_idx";
--   DROP INDEX "Listing_title_trgm_idx";
--   ALTER TABLE "Business"/"Listing" ALTER COLUMN "searchVector" DROP DEFAULT;
--
-- All five are OMITTED. Prisma cannot express them, so it reports them as
-- drift on every migration; applying them would silently break full-text and
-- fuzzy search across the site.

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "venueName" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "priceNote" TEXT,
    "free" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "imageUrl" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "businessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_city_endsAt_idx" ON "Event"("status", "city", "endsAt");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_businessId_idx" ON "Event"("businessId");

-- CreateIndex: re-importing the City feed must update rows, never duplicate
-- them. The feed publishes one row per occurrence date, so the importer
-- collapses a run of dates onto a single sourceId before it ever gets here.
CREATE UNIQUE INDEX "Event_source_sourceId_key" ON "Event"("source", "sourceId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: an event cannot end before it starts. Prisma cannot express a
-- CHECK, and the date span is computed by the importer from a group of
-- occurrence rows — precisely the kind of derived value that should not be
-- trusted to be sane just because the code looked right.
ALTER TABLE "Event" ADD CONSTRAINT "Event_dates_ordered" CHECK ("endsAt" >= "startsAt");
