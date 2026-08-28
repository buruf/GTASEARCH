-- Production incident, 2026-08-28: 432 P2024 "timed out fetching a connection
-- from the connection pool" errors across 110 users, on /biz/[slug],
-- /biz/[slug]/claim, /, /directory/[category]/[city] and /events/[slug].
--
-- Not a bug in any one route. DATABASE_URL sets connection_limit=1 (the
-- Supabase + pgbouncer recommendation for serverless), so every query on a
-- request serialises through a single connection. As the directory grew from
-- ~20,000 rows to 55,318, the per-request database time grew past the 10s pool
-- timeout and requests began queueing until they failed.
--
-- The worst offender, measured with EXPLAIN ANALYZE on production:
--
--   SELECT ... FROM "Business"
--   WHERE status='active' AND category='restaurants' AND city='toronto'
--   ORDER BY plan DESC, verified DESC, name, id LIMIT 4
--
--   -> Bitmap Heap Scan, 8,394 rows read, top-N heapsort, 671 ms — to return 4.
--
-- Business_category_city_status_idx serves the WHERE but not the ORDER BY, so
-- Postgres had to read and sort every restaurant in Toronto on every business
-- page view. These indexes carry the sort columns too, letting the planner walk
-- the index and stop at LIMIT.
--
-- Two shapes because `city` is optional on browse pages: a category-only browse
-- cannot use an index whose second column is city.
--
-- Column order and direction must match the ORDER BY exactly or Postgres will
-- not use them for sorting: plan DESC puts 'pro' before 'free', verified DESC
-- puts true first.

CREATE INDEX "Business_browse_category_sort_idx"
  ON "Business" ("category", "status", "plan" DESC, "verified" DESC, "name", "id");

CREATE INDEX "Business_browse_category_city_sort_idx"
  ON "Business" ("category", "city", "status", "plan" DESC, "verified" DESC, "name", "id");
