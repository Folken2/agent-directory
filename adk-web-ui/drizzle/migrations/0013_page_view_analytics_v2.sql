ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "bot_confidence" text;
--> statement-breakpoint
ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "bot_signals" text;
