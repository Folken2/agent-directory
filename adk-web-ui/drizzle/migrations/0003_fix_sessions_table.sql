-- Fix sessions table structure to match @auth/drizzle-adapter requirements
-- The adapter expects 'sessions' table with session_token as primary key

-- Step 1: Check if sessions table exists and what structure it has
-- If it's the ADK sessions table (has app_name), we need to handle it differently
-- For now, we'll assume we need to create/fix the NextAuth sessions table

-- Drop the sessions table if it exists and doesn't have the right structure
DO $$
BEGIN
  -- Check if sessions table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'sessions' AND table_schema = 'public'
  ) THEN
    -- Check if it's the ADK sessions table (has app_name column)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'sessions' AND column_name = 'app_name'
    ) THEN
      -- This is ADK sessions table, rename it to adk_sessions
      ALTER TABLE "sessions" RENAME TO "adk_sessions";
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'sessions' AND column_name = 'id' AND column_name != 'session_token'
    ) THEN
      -- Wrong structure (has id but not session_token as PK), drop it
      DROP TABLE IF EXISTS "sessions" CASCADE;
    END IF;
  END IF;
END $$;
--> statement-breakpoint

-- Step 2: Create sessions table with correct structure for NextAuth
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint

-- Step 3: Migrate data from auth_sessions to sessions (if auth_sessions exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'auth_sessions' AND table_schema = 'public'
  ) THEN
    INSERT INTO "sessions" ("session_token", "user_id", "expires")
    SELECT "session_token", "user_id", "expires"
    FROM "auth_sessions"
    ON CONFLICT ("session_token") DO NOTHING;
  END IF;
END $$;
--> statement-breakpoint

-- Step 4: Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sessions_user_id_users_id_fk' AND table_name = 'sessions'
  ) THEN
    ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

-- Step 5: Create index on user_id
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" USING btree ("user_id");
--> statement-breakpoint

-- Step 6: Drop old auth_sessions table (optional, can keep for rollback)
-- DROP TABLE IF EXISTS "auth_sessions" CASCADE;
--> statement-breakpoint
