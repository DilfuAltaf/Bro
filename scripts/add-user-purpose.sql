-- =====================================================================
-- BROAGENT — Add User.purpose (onboarding: work/study/personal/...)
-- =====================================================================
-- Run in Supabase Dashboard -> SQL Editor (once).
-- Safe to re-run (IF NOT EXISTS / idempotent DO block).
-- Allowed values: work, study, personal, developer, creator, research.
-- Nullable: old users & guests stay neutral until they pick one.
-- =====================================================================

-- 1. Column (nullable, no default — null means "not chosen yet")
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "purpose" TEXT;

-- 2. Check constraint for allowed purposes (drop + recreate to stay idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_purpose_check'
  ) THEN
    ALTER TABLE "User" DROP CONSTRAINT "User_purpose_check";
  END IF;
  ALTER TABLE "User"
    ADD CONSTRAINT "User_purpose_check"
    CHECK ("purpose" IS NULL OR "purpose" IN ('work', 'study', 'personal', 'developer', 'creator', 'research'));
END
$$;

-- 3. Index (optional, for future per-purpose analytics)
CREATE INDEX IF NOT EXISTS "User_purpose_idx" ON "User"("purpose");
