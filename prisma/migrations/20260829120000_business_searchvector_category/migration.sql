-- Put the category into the business search index.
--
-- Reported by the owner: searching "halal food" returned far fewer results
-- than it should. The searchVector covered name (weight A) and description
-- (weight B), and the description is boilerplate carrying only the SUBcategory
-- label — "Fast Food in Toronto", "Grocery in Brampton". Because the query
-- ANDs its words, "halal food" matched the halal places filed as Fast Food and
-- missed every halal grocer, whose stored text contains no "food" at all.
--
-- Adding the category label means a generic word in a query ("food", "medical",
-- "services") is satisfied by what the business IS, leaving the distinctive
-- word ("halal") to do the real filtering.
--
-- Weight C, deliberately below name (A) and description (B): a business called
-- "Halal Meat" should always outrank one that merely happens to be a
-- restaurant. ts_rank already reflects that ordering.
--
-- The subcategory slug is included with hyphens replaced by spaces, so
-- "hair-salons" tokenises as "hair" and "salon" rather than one odd token.
--
-- The CASE is a static copy of BUSINESS_CATEGORIES in lib/business-categories.ts.
-- A migration cannot import TypeScript, so lib/search-index.test.ts asserts
-- that every category in the taxonomy appears here — add a category without
-- updating this file and that test fails loudly rather than the new category
-- silently becoming unsearchable.
--
-- Dropping the column drops the dependent GIN index with it, so both are
-- recreated below. On 55,318 rows this rewrite takes seconds.

ALTER TABLE "Business" DROP COLUMN "searchVector";

ALTER TABLE "Business" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english',
      CASE "category"
        WHEN 'restaurants' THEN 'Restaurants & Food'
        WHEN 'health' THEN 'Health & Medical'
        WHEN 'home-services' THEN 'Home Services'
        WHEN 'beauty' THEN 'Beauty & Wellness'
        WHEN 'automotive' THEN 'Automotive'
        WHEN 'professional' THEN 'Professional Services'
        WHEN 'shopping' THEN 'Shopping & Retail'
        WHEN 'education' THEN 'Education & Childcare'
        WHEN 'fitness' THEN 'Fitness & Recreation'
        WHEN 'pets' THEN 'Pets'
        WHEN 'religion' THEN 'Places of Worship'
        ELSE ''
      END
      || ' ' || replace(coalesce("subcategory", ''), '-', ' ')
    ), 'C')
) STORED;

-- Recreate the GIN index dropped with the column.
CREATE INDEX "Business_searchVector_idx" ON "Business" USING GIN ("searchVector");
