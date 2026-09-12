-- Make emailCanonical impossible to forget.
--
-- The previous migration added it as an ordinary column, which meant every
-- caller had to remember to populate it. That is exactly the kind of rule that
-- holds until it doesn't:
--
--   * NextAuth's PrismaAdapter creates users for Google sign-in inside the
--     library. It cannot know about this column, so every Google registration
--     would have failed outright.
--   * Twenty integration tests create users directly.
--   * Any future caller has to know a rule written down somewhere else.
--
-- A STORED generated column removes the question. Postgres derives the value
-- from "email" on every insert and update, so it can never drift from the
-- address it describes and no code path can omit it. Same technique the
-- Business and Listing search vectors already use in this schema.
--
-- Every function here is IMMUTABLE (lower, split_part, replace, ||), which is
-- what a generated expression requires.
--
-- lib/email-identity.ts holds the identical rule in TypeScript: the column is
-- the guarantee, the TypeScript is the friendly error before we get there, and
-- lib/email-identity.test.ts pins the shared behaviour.

DROP INDEX IF EXISTS "User_emailCanonical_key";
ALTER TABLE "User" DROP COLUMN "emailCanonical";

ALTER TABLE "User" ADD COLUMN "emailCanonical" TEXT GENERATED ALWAYS AS (
  CASE
    -- Malformed or degenerate addresses keep their literal value rather than
    -- collapsing to a shared "@gmail.com", which would make all of them
    -- collide with each other.
    WHEN split_part(lower("email"), '@', 2) = ''
      OR length(split_part(split_part(lower("email"), '@', 1), '+', 1)) = 0
      THEN lower("email")
    WHEN split_part(lower("email"), '@', 2) IN ('gmail.com', 'googlemail.com') THEN
      CASE
        WHEN length(replace(split_part(split_part(lower("email"), '@', 1), '+', 1), '.', '')) = 0
          THEN lower("email")
        ELSE replace(split_part(split_part(lower("email"), '@', 1), '+', 1), '.', '') || '@gmail.com'
      END
    -- Dots are significant for every provider except Gmail. Stripping them
    -- elsewhere would merge two real, unrelated people into one account.
    ELSE split_part(split_part(lower("email"), '@', 1), '+', 1)
         || '@' || split_part(lower("email"), '@', 2)
  END
) STORED;

-- A generated column cannot be given a per-row exception, so the five
-- pre-existing alias pairs can no longer be fudged into uniqueness the way the
-- previous migration did. They are real duplicate accounts and the index must
-- reflect that, so this is a PARTIAL unique index: it binds every inbox that
-- does not already have more than one account, and leaves the existing five
-- pairs alone rather than failing to build or deleting somebody's row.
--
-- New registrations cannot join those clusters either, because the register
-- action rejects an address whose canonical form already exists. The five are
-- listed explicitly so the exemption is visible, finite, and removable once
-- the duplicates are cleaned up.
CREATE UNIQUE INDEX "User_emailCanonical_key" ON "User"("emailCanonical")
WHERE "emailCanonical" NOT IN (
  'artisticdecks1@gmail.com',
  'kleanologyforyou@gmail.com',
  'mathesonse@gmail.com',
  'ramchosafety1@gmail.com',
  'robertsbodyshopp@gmail.com'
);
