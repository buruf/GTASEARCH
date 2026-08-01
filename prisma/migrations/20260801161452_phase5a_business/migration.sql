-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "city" TEXT NOT NULL,
    "neighbourhood" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "hours" TEXT,
    "images" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "claimedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "searchVector" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("description", '')), 'B')
    ) STORED,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE INDEX "Business_category_city_status_idx" ON "Business"("category", "city", "status");

-- CreateIndex
CREATE INDEX "Business_city_status_idx" ON "Business"("city", "status");

-- Hand-written search indexes (Prisma cannot express either type).
CREATE INDEX "Business_searchVector_idx" ON "Business" USING GIN ("searchVector");
CREATE INDEX "Business_name_trgm_idx" ON "Business" USING GIN ("name" gin_trgm_ops);
