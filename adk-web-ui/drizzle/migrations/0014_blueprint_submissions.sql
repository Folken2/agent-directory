CREATE TABLE IF NOT EXISTS "blueprint_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"user_id" text,
	"session_id" text,
	"blueprint_name" text NOT NULL,
	"blueprint" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_blueprint_submissions_created_at" ON "blueprint_submissions" USING btree ("created_at");
