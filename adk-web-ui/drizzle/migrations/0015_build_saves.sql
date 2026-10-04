CREATE TABLE IF NOT EXISTS "build_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_hash" text NOT NULL,
	"email" text,
	"user_id" text,
	"session_id" text NOT NULL,
	"project_name" text NOT NULL,
	"build" jsonb NOT NULL,
	"zip" bytea,
	"zip_bytes" integer NOT NULL,
	"updates_consent_at" timestamp with time zone,
	"help_requested" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp with time zone,
	"notified" boolean DEFAULT false NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"last_downloaded_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "build_saves_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_build_saves_created_at" ON "build_saves" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_build_saves_session_id" ON "build_saves" USING btree ("session_id");
