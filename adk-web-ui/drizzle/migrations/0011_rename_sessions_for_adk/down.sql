-- Rollback migration: Restore NextAuth sessions table to original name

-- Step 1: Drop the new constraint
ALTER TABLE IF EXISTS "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_user_id_users_id_fk";
--> statement-breakpoint

-- Step 2: Drop the new index
DROP INDEX IF EXISTS "idx_auth_sessions_user_id";
--> statement-breakpoint

-- Step 3: Rename table back to sessions
ALTER TABLE IF EXISTS "auth_sessions" RENAME TO "sessions";
--> statement-breakpoint

-- Step 4: Recreate original index
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" USING btree ("user_id");
--> statement-breakpoint

-- Step 5: Recreate original constraint
ALTER TABLE "sessions" 
ADD CONSTRAINT "sessions_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

