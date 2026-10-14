-- =====================================================================
-- BROAGENT — Add User.language (multilanguage support, default English)
-- =====================================================================
-- Run in Supabase Dashboard -> SQL Editor (once).
-- Safe to re-run (IF NOT EXISTS / idempotent DO block).
-- Allowed values: en, ar, id, ru, zh, ja, ko. Default: en.
-- =====================================================================

-- 1. Column (default 'en' for existing + new rows)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en';

-- 2. Backfill NULL/empty just in case
UPDATE "User" SET "language" = 'en' WHERE "language" IS NULL OR "language" = '';

-- 3. Check constraint for allowed languages (drop + recreate to stay idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_language_check'
  ) THEN
    ALTER TABLE "User" DROP CONSTRAINT "User_language_check";
  END IF;
  ALTER TABLE "User"
    ADD CONSTRAINT "User_language_check"
    CHECK ("language" IN ('en', 'ar', 'id', 'ru', 'zh', 'ja', 'ko'));
END
$$;

-- 4. Index (optional, for future per-language analytics)
CREATE INDEX IF NOT EXISTS "User_language_idx" ON "User"("language");
