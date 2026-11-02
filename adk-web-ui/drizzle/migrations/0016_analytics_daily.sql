CREATE TABLE IF NOT EXISTS "page_view_daily" (
	"day" date NOT NULL,
	"path" text NOT NULL,
	"is_bot" boolean NOT NULL,
	"bot_name" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"device_type" text DEFAULT '' NOT NULL,
	"ref_host" text DEFAULT '' NOT NULL,
	"views" integer NOT NULL,
	CONSTRAINT "page_view_daily_pk" PRIMARY KEY("day","path","is_bot","bot_name","country","device_type","ref_host")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_daily" (
	"day" date NOT NULL,
	"event_type" text NOT NULL,
	"agent_slug" text DEFAULT '' NOT NULL,
	"path" text NOT NULL,
	"landing_path" text DEFAULT '' NOT NULL,
	"events" integer NOT NULL,
	"visits" integer NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "engagement_daily_pk" PRIMARY KEY("day","event_type","agent_slug","path","landing_path")
);
