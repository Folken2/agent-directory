CREATE TABLE "anonymous_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_interaction_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anonymous_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
ALTER TABLE "agent_run_events" ADD COLUMN "rate_limit_identifier" text;--> statement-breakpoint
CREATE INDEX "idx_anonymous_sessions_token" ON "anonymous_sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "idx_anonymous_sessions_created_at" ON "anonymous_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_run_events_rate_limit" ON "agent_run_events" USING btree ("rate_limit_identifier","created_at");