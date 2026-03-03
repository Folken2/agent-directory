-- Reverse migration: Recreate auth_sessions table
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint

-- Migrate data back
INSERT INTO "auth_sessions" ("session_token", "user_id", "expires", "created_at")
SELECT "session_token", "user_id", "expires", NOW()
FROM "sessions";
--> statement-breakpoint

-- Add foreign key and indexes
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX "idx_auth_sessions_session_token" ON "auth_sessions" USING btree ("session_token");
--> statement-breakpoint

CREATE INDEX "idx_auth_sessions_user_id" ON "auth_sessions" USING btree ("user_id");
--> statement-breakpoint

CREATE INDEX "idx_auth_sessions_expires" ON "auth_sessions" USING btree ("expires");
--> statement-breakpoint

-- Drop new sessions table
DROP TABLE IF EXISTS "sessions" CASCADE;
--> statement-breakpoint

