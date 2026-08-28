-- Coordinates on Business, for "near me" distance search.
--
-- HAND-EDITED. `prisma migrate diff` again proposed dropping the four
-- hand-built search indexes and the generated tsvector defaults; all of that
-- is OMITTED. Prisma cannot express them so it reports them as drift on every
-- migration, and applying it would silently break search site-wide.

ALTER TABLE "Business" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- Distance search filters to a bounding box first (cheap, indexable) and only
-- then computes true great-circle distance on the survivors. This index is
-- what makes the box lookup fast; without it every "near me" query would be a
-- sequential scan of 55,318 rows — the same mistake that caused the
-- 2026-08-28 connection-pool incident.
--
-- Partial, because roughly a third of rows have no coordinates and indexing
-- them would only make the index bigger for no benefit.
CREATE INDEX "Business_coordinates_idx"
  ON "Business" ("latitude", "longitude")
  WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "status" = 'active';

-- Guard against nonsense coordinates. A latitude/longitude swap is the classic
-- geocoding bug and would silently place every business in the Indian Ocean;
-- these bounds are generous around the GTA but would catch it immediately.
ALTER TABLE "Business" ADD CONSTRAINT "Business_coordinates_in_range" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL)
  OR ("latitude" BETWEEN 42.0 AND 45.5 AND "longitude" BETWEEN -81.5 AND -77.0)
);
