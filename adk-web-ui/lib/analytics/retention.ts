/**
 * Retention job, run daily by the Vercel cron at /api/cron/analytics-retention.
 *
 *   1. Raw `page_views` and `engagement_events` older than 90 days are rolled
 *      up into `page_view_daily` / `engagement_daily`, one UTC day at a time,
 *      and that day's raw rows are then deleted.
 *   2. ADK `events` (prompts and replies) and `sessions` (transcript state)
 *      not touched in 30 days are deleted.
 *
 * Each day is rolled up from the full raw day and upserted before the delete,
 * so a run that dies half-way is repaired by the next one.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { engagementDaily, pageViewDaily } from '@/lib/drizzle/schema/analytics-daily';
import { unwrapExecuteRows } from '@/lib/drizzle/unwrap-rows';
import { detectAdkEventsSchema } from './adk-events';
import { isAnalyticsDbAvailable } from './db-available';
import { ensurePageViewsSchema } from './ensure-schema';
import {
  rawCutoff,
  rollUpEngagement,
  rollUpPageViews,
  transcriptCutoff,
  type RawEngagementRow,
  type RawPageViewRow,
} from './retention-rollup';

/** Days rolled up per run per table; a backlog drains over a few nights. */
const MAX_DAYS_PER_RUN = 30;
const INSERT_CHUNK = 500;

export type RetentionReport = {
  /** Set when the roll-up step did not run (migration 0016 not applied). */
  rollupSkipped?: string;
  pageViewDays: string[];
  pageViewRowsDeleted: number;
  engagementDays: string[];
  engagementRowsDeleted: number;
  adkEventsDeleted: number;
  adkSessionsDeleted: number;
};

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function dayBounds(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function staleDays(table: 'page_views' | 'engagement_events', cutoff: string): Promise<string[]> {
  const rows = unwrapExecuteRows<{ day: string }>(
    await db.execute(sql`
      SELECT DISTINCT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day
      FROM ${sql.identifier(table)}
      WHERE created_at < ${cutoff}
      ORDER BY 1
      LIMIT ${MAX_DAYS_PER_RUN}
    `)
  );
  return rows.map((r) => String(r.day));
}

function countOf(result: unknown): number {
  if (result && typeof result === 'object' && 'rowCount' in result) {
    return Number((result as { rowCount: number | null }).rowCount ?? 0);
  }
  return 0;
}

async function rollUpPageViewDay(day: string): Promise<number> {
  const { start, end } = dayBounds(day);
  const raw = unwrapExecuteRows<{
    path: string;
    is_bot: boolean | null;
    bot_name: string | null;
    country: string | null;
    device_type: string | null;
    referrer: string | null;
  }>(
    await db.execute(sql`
      SELECT path, is_bot, bot_name, country, device_type, referrer
      FROM page_views WHERE created_at >= ${start} AND created_at < ${end}
    `)
  );
  const rows = rollUpPageViews(
    raw.map<RawPageViewRow>((r) => ({
      day,
      path: r.path,
      isBot: Boolean(r.is_bot),
      botName: r.bot_name,
      country: r.country,
      deviceType: r.device_type,
      referrer: r.referrer,
    }))
  );
  for (const part of chunks(rows, INSERT_CHUNK)) {
    await db
      .insert(pageViewDaily)
      .values(part)
      .onConflictDoUpdate({
        target: [
          pageViewDaily.day,
          pageViewDaily.path,
          pageViewDaily.isBot,
          pageViewDaily.botName,
          pageViewDaily.country,
          pageViewDaily.deviceType,
          pageViewDaily.refHost,
        ],
        set: { views: sql`excluded.views` },
      });
  }
  return countOf(
    await db.execute(sql`DELETE FROM page_views WHERE created_at >= ${start} AND created_at < ${end}`)
  );
}

async function rollUpEngagementDay(day: string): Promise<number> {
  const { start, end } = dayBounds(day);
  const raw = unwrapExecuteRows<{
    event_type: string;
    agent_slug: string | null;
    path: string;
    visitor_id: string;
    duration_ms: number | null;
    metadata: string | null;
  }>(
    await db.execute(sql`
      SELECT event_type, agent_slug, path, visitor_id, duration_ms, metadata
      FROM engagement_events WHERE created_at >= ${start} AND created_at < ${end}
    `)
  );
  const rows = rollUpEngagement(
    raw.map<RawEngagementRow>((r) => ({
      day,
      eventType: r.event_type,
      agentSlug: r.agent_slug,
      path: r.path,
      visitorId: r.visitor_id,
      durationMs: r.duration_ms === null ? null : Number(r.duration_ms),
      metadata: r.metadata,
    }))
  );
  for (const part of chunks(rows, INSERT_CHUNK)) {
    await db
      .insert(engagementDaily)
      .values(part)
      .onConflictDoUpdate({
        target: [
          engagementDaily.day,
          engagementDaily.eventType,
          engagementDaily.agentSlug,
          engagementDaily.path,
          engagementDaily.landingPath,
        ],
        set: {
          events: sql`excluded.events`,
          visits: sql`excluded.visits`,
          durationMs: sql`excluded.duration_ms`,
        },
      });
  }
  return countOf(
    await db.execute(
      sql`DELETE FROM engagement_events WHERE created_at >= ${start} AND created_at < ${end}`
    )
  );
}

async function hasRollupTables(): Promise<boolean> {
  const rows = unwrapExecuteRows<{ ok: boolean }>(
    await db.execute(sql`
      SELECT to_regclass('page_view_daily') IS NOT NULL AND to_regclass('engagement_daily') IS NOT NULL AS ok
    `)
  );
  return Boolean(rows[0]?.ok);
}

/** Deletes ADK prompts/replies and session state older than the transcript window. */
async function pruneTranscripts(cutoff: string): Promise<{ events: number; sessions: number }> {
  if (!(await detectAdkEventsSchema())) return { events: 0, sessions: 0 };
  const events = countOf(await db.execute(sql`DELETE FROM events WHERE "timestamp" < ${cutoff}`));
  // Sessions untouched since the cutoff have no newer events left.
  const sessions = countOf(await db.execute(sql`DELETE FROM sessions WHERE update_time < ${cutoff}`));
  return { events, sessions };
}

export async function runAnalyticsRetention(now: Date = new Date()): Promise<RetentionReport> {
  const report: RetentionReport = {
    pageViewDays: [],
    pageViewRowsDeleted: 0,
    engagementDays: [],
    engagementRowsDeleted: 0,
    adkEventsDeleted: 0,
    adkSessionsDeleted: 0,
  };
  if (!isAnalyticsDbAvailable()) return report;
  await ensurePageViewsSchema();

  const cutoff = rawCutoff(now).toISOString();
  if (await hasRollupTables()) {
    for (const day of await staleDays('page_views', cutoff)) {
      report.pageViewRowsDeleted += await rollUpPageViewDay(day);
      report.pageViewDays.push(day);
    }
    for (const day of await staleDays('engagement_events', cutoff)) {
      report.engagementRowsDeleted += await rollUpEngagementDay(day);
      report.engagementDays.push(day);
    }
  } else {
    // Never delete raw rows we could not roll up first.
    report.rollupSkipped = 'page_view_daily / engagement_daily missing: apply migration 0016';
  }

  const pruned = await pruneTranscripts(transcriptCutoff(now).toISOString());
  report.adkEventsDeleted = pruned.events;
  report.adkSessionsDeleted = pruned.sessions;
  return report;
}
