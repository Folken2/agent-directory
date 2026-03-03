-- Migration: Rename sessions to auth_sessions for ADK compatibility
-- This allows ADK backend to use 'sessions' table for agent sessions

-- Step 1: Rename current NextAuth sessions table to auth_sessions
ALTER TABLE IF EXISTS "sessions" RENAME TO "auth_sessions";
--> statement-breakpoint

-- Step 2: Update index name to match new table name
DROP INDEX IF EXISTS "idx_sessions_user_id";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_auth_sessions_user_id" ON "auth_sessions" USING btree ("user_id");
--> statement-breakpoint

-- Step 3: Update foreign key constraint name
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sessions_user_id_users_id_fk' 
    AND table_name = 'auth_sessions'
  ) THEN
    ALTER TABLE "auth_sessions" DROP CONSTRAINT "sessions_user_id_users_id_fk";
  END IF;

  -- Add new constraint with updated name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'auth_sessions_user_id_users_id_fk' 
    AND table_name = 'auth_sessions'
  ) THEN
    ALTER TABLE "auth_sessions" 
    ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
    ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

-- Note: After this migration:
-- - 'auth_sessions' = NextAuth user sessions (session_token, user_id, expires)
-- - 'sessions' table will be created by ADK backend (app_name, user_id, id, state)

