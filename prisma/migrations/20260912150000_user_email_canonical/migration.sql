-- One inbox, one account.
--
-- "User"."email" is unique as a STRING, which is not the same as the mailbox
-- behind it. Between 2026-09-04 and 2026-09-12 that gap was used to register
-- 131 accounts, every one a dot-permutation of a real business inbox:
--
--     kle.an.o.l.og.y.fo.r.y.ou@gmail.com  and  k.lea.no.lo.gy.f.or.you@gmail.com
--
-- Gmail ignores dots in the local part and everything after a "+", so both
-- deliver to kleanologyforyou@gmail.com. Each is a distinct string, so the
-- unique index on "email" never fired once across 146 registrations.
--
-- This adds the mailbox itself as a column and makes THAT unique, so a new
-- account needs a genuinely new inbox. lib/email-identity.ts holds the same
-- rule for the application; lib/email-identity.test.ts pins the behaviour, and
-- the two must agree — the column is the guarantee, the TypeScript is the
-- friendly error message.
--
-- Rehearsed against production data inside a rolled-back transaction before
-- being written: the unique index builds, and exactly 5 pre-existing rows need
-- the fallback below.

ALTER TABLE "User" ADD COLUMN "emailCanonical" TEXT;

UPDATE "User" SET "emailCanonical" =
  CASE
    -- Malformed or degenerate addresses keep their literal value rather than
    -- collapsing to a shared "@gmail.com", which would make every one of them
    -- collide with every other.
    WHEN split_part(lower("email"), '@', 2) = ''
      OR length(split_part(split_part(lower("email"), '@', 1), '+', 1)) = 0
      THEN lower("email")
    WHEN split_part(lower("email"), '@', 2) IN ('gmail.com', 'googlemail.com') THEN
      CASE
        WHEN length(replace(split_part(split_part(lower("email"), '@', 1), '+', 1), '.', '')) = 0
          THEN lower("email")
        ELSE replace(split_part(split_part(lower("email"), '@', 1), '+', 1), '.', '') || '@gmail.com'
      END
    -- Dots are significant for every other provider. Stripping them there
    -- would merge two real, unrelated people into one account.
    ELSE split_part(split_part(lower("email"), '@', 1), '+', 1)
         || '@' || split_part(lower("email"), '@', 2)
  END;

-- Five accounts already registered are aliases of another. They are not
-- deleted here: a migration is the wrong place to decide that somebody's
-- account should cease to exist, and these rows are evidence of how the site
-- was abused. The earliest of each pair keeps the true canonical; the later
-- one falls back to its own literal address, which is unique because it
-- contains the dots that made it an alias in the first place. The effect is
-- that they stay signed-in-able but can never be joined to as one inbox.
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "emailCanonical" ORDER BY "createdAt", "id"
  ) AS rn
  FROM "User"
)
UPDATE "User" u
SET "emailCanonical" = lower(u."email")
FROM ranked r
WHERE u."id" = r."id" AND r.rn > 1;

ALTER TABLE "User" ALTER COLUMN "emailCanonical" SET NOT NULL;

CREATE UNIQUE INDEX "User_emailCanonical_key" ON "User"("emailCanonical");
