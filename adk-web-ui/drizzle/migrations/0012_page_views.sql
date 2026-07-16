CREATE TABLE IF NOT EXISTS "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"path" text NOT NULL,
	"query" text,
	"referrer" text,
	"country" text,
	"region" text,
	"city" text,
	"hashed_ip" text,
	"visitor_id" text NOT NULL,
	"user_id" text,
	"user_agent" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"bot_name" text,
	"bot_category" text,
	"browser" text,
	"os" text,
	"device_type" text,
	"language" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_views_created_at" ON "page_views" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_views_country" ON "page_views" USING btree ("country");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_views_path" ON "page_views" USING btree ("path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_views_visitor_id" ON "page_views" USING btree ("visitor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_views_is_bot" ON "page_views" USING btree ("is_bot");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_views_user_id" ON "page_views" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_page_views_dedupe" ON "page_views" USING btree ("visitor_id","path","created_at");
