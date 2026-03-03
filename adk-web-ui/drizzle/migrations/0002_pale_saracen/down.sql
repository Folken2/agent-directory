-- Down migration for rate limiting feature
-- This migration rolls back the addition of rate limiting infrastructure
-- 
-- WARNING: This will remove the rate_limit_identifier column from agent_run_events
-- Any data in that column will be lost. This is acceptable in development mode.

-- Drop indexes first (in reverse order of creation)
DROP INDEX IF EXISTS "idx_agent_run_events_rate_limit";
DROP INDEX IF EXISTS "idx_anonymous_sessions_created_at";
DROP INDEX IF EXISTS "idx_anonymous_sessions_token";

-- Remove rate_limit_identifier column from agent_run_events
-- Note: This will lose any rate limit tracking data, but that's acceptable in dev mode
ALTER TABLE "agent_run_events" DROP COLUMN IF EXISTS "rate_limit_identifier";

-- Drop anonymous_sessions table
-- WARNING: This will delete all anonymous session data
DROP TABLE IF EXISTS "anonymous_sessions";

