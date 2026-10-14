-- =====================================================================
-- BROAGENT — PostgreSQL Schema for Supabase (Direct Client Migration)
-- =====================================================================
-- Date: October 2026
-- Description:
--   Complete schema corresponding to BroAgent's data model without Prisma.
--   Preserves application semantics, foreign keys, cascade deletes,
--   exact TypeScript property casing, guest user IDs, and automatic timestamps.
--
-- Execution:
--   Run this script in the Supabase Dashboard -> SQL Editor.
-- =====================================================================

-- Ensure UUID generation functions are available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Helper Function: Automatic updatedAt Timestamp Trigger
-- ---------------------------------------------------------------------
-- Mirrors Prisma's @updatedAt behavior automatically at the database level.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 2. Table: "User"
-- ---------------------------------------------------------------------
-- Stores registered users and dynamic guest accounts.
-- ID is TEXT to accommodate both generated random UUIDs and custom
-- guest IDs (e.g. "guest-171829381029-a1b2c3d4").
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" VARCHAR(255),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255),
    "image" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en' CHECK ("language" IN ('en', 'ar', 'id', 'ru', 'zh', 'ja', 'ko')),
    "purpose" TEXT CHECK ("purpose" IS NULL OR "purpose" IN ('work', 'study', 'personal', 'developer', 'creator', 'research')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger for "User"."updatedAt"
DROP TRIGGER IF EXISTS set_user_updated_at ON "User";
CREATE TRIGGER set_user_updated_at
BEFORE UPDATE ON "User"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- 3. Table: "ConversationThread"
-- ---------------------------------------------------------------------
-- Stores conversation threads initiated by authenticated or guest users.
-- Deleting a user cascades and deletes all associated threads.
CREATE TABLE IF NOT EXISTS "ConversationThread" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationThread_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Index for fast user conversation history lookup (matching @@index([userId]))
CREATE INDEX IF NOT EXISTS "ConversationThread_userId_idx"
    ON "ConversationThread"("userId");

-- Trigger for "ConversationThread"."updatedAt"
DROP TRIGGER IF EXISTS set_conversation_updated_at ON "ConversationThread";
CREATE TRIGGER set_conversation_updated_at
BEFORE UPDATE ON "ConversationThread"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- 4. Table: "Message"
-- ---------------------------------------------------------------------
-- Stores individual chat messages (user, assistant, system).
-- Content is TEXT (replacing MySQL @db.LongText).
-- Deleting a conversation cascades and deletes all its messages.
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey"
        FOREIGN KEY ("conversationId")
        REFERENCES "ConversationThread"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Composite index matching @@index([conversationId, createdAt])
-- Optimizes history builder queries (ORDER BY createdAt DESC) and
-- thread replay queries (ORDER BY createdAt ASC).
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
    ON "Message"("conversationId", "createdAt");

-- ---------------------------------------------------------------------
-- 5. Table: "Memory"
-- ---------------------------------------------------------------------
-- Stores long-term user memories and context items.
-- Deleting a user cascades and deletes their memories.
CREATE TABLE IF NOT EXISTS "Memory" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Memory_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Index for memory retrieval by user (matching @@index([userId]))
CREATE INDEX IF NOT EXISTS "Memory_userId_idx"
    ON "Memory"("userId");

-- Trigger for "Memory"."updatedAt"
DROP TRIGGER IF EXISTS set_memory_updated_at ON "Memory";
CREATE TRIGGER set_memory_updated_at
BEFORE UPDATE ON "Memory"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------
-- 6. Table: "WorkflowRun"
-- ---------------------------------------------------------------------
-- Records AI execution mode, intent classifications, and completion status.
-- Deleting a conversation cascades and deletes associated workflow runs.
CREATE TABLE IF NOT EXISTS "WorkflowRun" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "conversationId" TEXT NOT NULL,
    "intent" VARCHAR(50) NOT NULL DEFAULT 'general',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    CONSTRAINT "WorkflowRun_conversationId_fkey"
        FOREIGN KEY ("conversationId")
        REFERENCES "ConversationThread"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Index for workflow run lookups by conversation (matching @@index([conversationId]))
CREATE INDEX IF NOT EXISTS "WorkflowRun_conversationId_idx"
    ON "WorkflowRun"("conversationId");

-- ---------------------------------------------------------------------
-- 7. Security: Row Level Security (RLS) Configuration
-- ---------------------------------------------------------------------
-- ARCHITECTURAL RATIONALE:
-- 1. BroAgent uses custom NestJS JWT authentication, NOT Supabase Auth.
-- 2. The NestJS backend accesses the database securely using the server-side
--    SUPABASE_SERVICE_ROLE_KEY, which inherently bypasses RLS.
-- 3. Enabling RLS without public policies prevents unauthorized direct access
--    from external browsers using the public anon key via the Supabase REST API.
-- 4. Tenant isolation and authorization remain strictly enforced in NestJS
--    via AuthGuard and ownership checks.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Memory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowRun" ENABLE ROW LEVEL SECURITY;

-- Note: We intentionally do NOT create permissive 'anon' policies.
-- Direct queries from client browsers via the public anon key will be denied,
-- ensuring that only the trusted NestJS backend (via service_role) can access data.
