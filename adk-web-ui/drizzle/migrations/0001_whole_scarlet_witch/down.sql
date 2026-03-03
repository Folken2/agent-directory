-- Down migration for: 0001_whole_scarlet_witch
-- Generated: 2025-12-12
-- 
-- This file reverses the changes made in migration.sql
-- Review carefully before executing in production
--
-- WARNINGS:
-- - Dropping agent_run_events table will permanently delete all agent run tracking data
-- - Dropping indexes will affect query performance

-- ==========================================
-- REVERSE INDEX OPERATIONS (LAST FIRST)
-- ==========================================

-- Reverse: CREATE INDEX "idx_agent_run_events_created_at"
DROP INDEX IF EXISTS "idx_agent_run_events_created_at";

-- Reverse: CREATE INDEX "idx_agent_run_events_session_id"
DROP INDEX IF EXISTS "idx_agent_run_events_session_id";

-- Reverse: CREATE INDEX "idx_agent_run_events_user_id"
DROP INDEX IF EXISTS "idx_agent_run_events_user_id";

-- Reverse: CREATE INDEX "idx_agent_run_events_slug"
DROP INDEX IF EXISTS "idx_agent_run_events_slug";

-- Reverse: CREATE INDEX "idx_agent_star_events_slug"
DROP INDEX IF EXISTS "idx_agent_star_events_slug";

-- Reverse: CREATE INDEX "idx_agent_star_events_slug_session"
DROP INDEX IF EXISTS "idx_agent_star_events_slug_session";

-- Reverse: CREATE INDEX "idx_agent_stats_slug"
DROP INDEX IF EXISTS "idx_agent_stats_slug";

-- ==========================================
-- REVERSE TABLE OPERATIONS (LAST FIRST)
-- ==========================================

-- Reverse: CREATE TABLE "agent_run_events"
-- WARNING: This will permanently delete all agent run tracking data
DROP TABLE IF EXISTS "agent_run_events";

-- Note: agent_stats and agent_star_events tables already existed
-- The migration only added indexes, which are dropped above
-- The tables themselves are not dropped to preserve existing data

