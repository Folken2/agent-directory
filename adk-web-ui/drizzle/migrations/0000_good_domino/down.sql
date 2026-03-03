-- Down migration for: 0000_good_domino
-- Generated: 2025-12-12
-- 
-- This file reverses the changes made in migration.sql
-- Review carefully before executing in production
--
-- WARNINGS:
-- - Dropping tables will permanently delete all data in accounts, users, auth_sessions, and verification_tokens
-- - Dropping the user_role enum will affect any columns using this type
-- - This is a complete rollback of the authentication schema

-- ==========================================
-- REVERSE INDEX OPERATIONS (LAST FIRST)
-- ==========================================

-- Reverse: CREATE INDEX "verification_tokens_pkey"
DROP INDEX IF EXISTS "verification_tokens_pkey";

-- Reverse: CREATE INDEX "idx_auth_sessions_expires"
DROP INDEX IF EXISTS "idx_auth_sessions_expires";

-- Reverse: CREATE INDEX "idx_auth_sessions_user_id"
DROP INDEX IF EXISTS "idx_auth_sessions_user_id";

-- Reverse: CREATE INDEX "idx_auth_sessions_session_token"
DROP INDEX IF EXISTS "idx_auth_sessions_session_token";

-- Reverse: CREATE INDEX "idx_users_email"
DROP INDEX IF EXISTS "idx_users_email";

-- Reverse: CREATE INDEX "idx_accounts_user_id"
DROP INDEX IF EXISTS "idx_accounts_user_id";

-- Reverse: CREATE INDEX "idx_accounts_provider"
DROP INDEX IF EXISTS "idx_accounts_provider";

-- ==========================================
-- REVERSE FOREIGN KEY OPERATIONS
-- ==========================================

-- Reverse: ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk"
ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_user_id_users_id_fk";

-- Reverse: ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk"
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_user_id_users_id_fk";

-- ==========================================
-- REVERSE TABLE OPERATIONS (LAST FIRST)
-- ==========================================

-- Reverse: CREATE TABLE "verification_tokens"
-- WARNING: This will permanently delete all verification token data
DROP TABLE IF EXISTS "verification_tokens";

-- Reverse: CREATE TABLE "auth_sessions"
-- WARNING: This will permanently delete all session data
DROP TABLE IF EXISTS "auth_sessions";

-- Reverse: CREATE TABLE "users"
-- WARNING: This will permanently delete all user data
DROP TABLE IF EXISTS "users";

-- Reverse: CREATE TABLE "accounts"
-- WARNING: This will permanently delete all OAuth account data
DROP TABLE IF EXISTS "accounts";

-- ==========================================
-- REVERSE TYPE OPERATIONS
-- ==========================================

-- Reverse: CREATE TYPE "public"."user_role"
-- WARNING: This will fail if any columns still reference this type
DROP TYPE IF EXISTS "public"."user_role";

