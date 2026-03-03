-- Create new agent_run_events table
CREATE TABLE "agent_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"app_name" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
-- Note: agent_star_events and agent_stats tables already exist
-- Only adding indexes to existing tables below
--> statement-breakpoint
CREATE INDEX "idx_agent_run_events_slug" ON "agent_run_events" USING btree ("agent_slug");--> statement-breakpoint
CREATE INDEX "idx_agent_run_events_user_id" ON "agent_run_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_run_events_session_id" ON "agent_run_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_agent_run_events_created_at" ON "agent_run_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_star_events_slug_session" ON "agent_star_events" USING btree ("agent_slug","session_id");--> statement-breakpoint
CREATE INDEX "idx_agent_star_events_slug" ON "agent_star_events" USING btree ("agent_slug");--> statement-breakpoint
CREATE INDEX "idx_agent_stats_slug" ON "agent_stats" USING btree ("agent_slug");