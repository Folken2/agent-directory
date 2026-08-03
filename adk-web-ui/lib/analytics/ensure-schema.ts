import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { isAnalyticsDbAvailable } from './db-available';

let ensured: Promise<void> | null = null;

/**
 * Idempotent schema bootstrap for analytics tables.
 * Prefer this over drizzle-kit migrate in the Vercel build — existing Neon DBs
 * often predate a clean __drizzle_migrations history.
 * (Build must stay `next build` only — no migrate step.)
 */
export async function ensurePageViewsSchema(): Promise<void> {
  if (!isAnalyticsDbAvailable()) return;
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
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
          "bot_confidence" text,
          "bot_signals" text,
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
        )
      `);

      await db.execute(sql`
        ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "bot_confidence" text
      `);
      await db.execute(sql`
        ALTER TABLE "page_views" ADD COLUMN IF NOT EXISTS "bot_signals" text
      `);

      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_page_views_created_at" ON "page_views" USING btree ("created_at")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_page_views_country" ON "page_views" USING btree ("country")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_page_views_path" ON "page_views" USING btree ("path")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_page_views_visitor_id" ON "page_views" USING btree ("visitor_id")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_page_views_is_bot" ON "page_views" USING btree ("is_bot")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_page_views_user_id" ON "page_views" USING btree ("user_id")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_page_views_dedupe" ON "page_views" USING btree ("visitor_id","path","created_at")
      `);

      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "engagement_events" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "visitor_id" text NOT NULL,
          "user_id" text,
          "agent_slug" text,
          "event_type" text NOT NULL,
          "path" text NOT NULL,
          "session_key" text,
          "duration_ms" integer,
          "metadata" text
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_engagement_created_at" ON "engagement_events" USING btree ("created_at")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_engagement_agent" ON "engagement_events" USING btree ("agent_slug")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_engagement_type" ON "engagement_events" USING btree ("event_type")
      `);
    })().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  await ensured;
}

/** Alias — engagement lives in the same bootstrap as page_views. */
export const ensureEngagementSchema = ensurePageViewsSchema;
