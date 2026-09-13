-- Prove the mailbox before letting an account speak in public.
--
-- The generated emailCanonical column (20260912160000) stopped one inbox
-- holding many accounts, but it cannot tell whether the person registering
-- owns that inbox at all. Anyone can type someone else's address, or a
-- plausible one nobody reads. 136 accounts removed on 2026-09-13 had never
-- confirmed anything, and nothing in the system had ever asked them to.
--
-- This holds the proof: a single-use token, hashed the same way the password
-- reset token is, so a leak of this table cannot be used to verify anybody.
-- Only the SHA-256 hash is stored; the raw value exists solely in the link.
--
-- User.emailVerified already existed on the model and was never written by any
-- code path. It becomes meaningful from here.

CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- Deleting the account takes its outstanding links with it, the same rule the
-- password reset tokens follow.
ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
