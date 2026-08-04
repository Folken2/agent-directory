/**
 * Server-only data layer for the ops analytics dashboard.
 *
 * Sources, and why these and not `engagement_events`:
 *   - `agent_run_events` — 8 months of runs with error status. One row per
 *     status change, so runs count terminal rows only (see lib/db-agent-runs.ts).
 *   - `events` / `sessions` (ADK-owned) — user prompts, same Neon instance.
 *   - `page_views` — traffic, classified through `path-classify` because ~36% of
 *     apparently-human views are credential scanners spoofing browser UAs.
 *   - `engagement_events` is deliberately unused: consent-gated and near-empty.
 *
 * Path classification and visit sessionization run in TypeScript rather than SQL
 * because the rules are richer than SQL patterns express cleanly. Path
 * cardinality is in the hundreds and view volume in the low thousands, so this
 * is cheap; `RAW_VIEW_LIMIT` caps the blast radius if traffic grows.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { unwrapExecuteRows } from '@/lib/drizzle/unwrap-rows';
import { isAnalyticsDbAvailable } from './db-available';
import { ensurePageViewsSchema } from './ensure-schema';
import { classifyPath, normalizePath } from './path-classify';
import {
  pageJourneyStats,
  sessionizeVisits,
  type PageJourneyStat,
  type RawPageView,
} from './visit-journeys';
import { timelineRangeDays, type TimelineRange } from './timeline-range';

/** Ceiling on rows pulled for sessionization. ~1.6k today. */
const RAW_VIEW_LIMIT = 50_000;

const TERMINAL_RUN_FILTER = sql`status in ('completed', 'error')`;

export type AgentUsageRow = {
  agentSlug: string;
  /** Terminal runs only — 'running' rows would double-count. */
  runs: number;
  errors: number;
  /** 0–1. Zero runs yields 0, not NaN. */
  errorRate: number;
  /**
   * Distinct signed-in users. Stable identity, so this really is a people count
   * — but only 12 exist site-wide, so treat small numbers literally.
   */
  authedUsers: number;
  /**
   * Distinct anonymous rate-limit tokens. These rotate per browser session, so
   * this counts *sessions*, not people, and runs close to the run count. Never
   * present it as an audience size.
   */
  anonSessions: number;
  prompts: number;
  promptSessions: number;
  /**
   * Views of `/agents/<slug>`. Zero can mean "nobody looked" *or* "the agent was
   * last used before pageview tracking began" — compare against
   * `fetchPageViewsSince()` before drawing conclusions.
   */
  pageViews: number;
  firstRunAt: string | null;
  lastRunAt: string | null;
};

export type PageUsageRow = {
  path: string;
  views: number;
  humanViews: number;
  botViews: number;
  /** Distinct hashed IPs among human views. */
  visitors: number;
  entries: number;
  exits: number;
  onwardRate: number;
  bounces: number;
};

export type MissingPathRow = {
  path: string;
  hits: number;
  /** Distinct hashed IPs — the difference between demand and one scraper. */
  visitors: number;
};

export type TrafficQuality = {
  totalViews: number;
  pageViews: number;
  scannerViews: number;
  missingViews: number;
  infraViews: number;
  /** Views on real pages from non-bot user agents. */
  humanPageViews: number;
  /** Non-bot views on scanner paths — spoofed UAs inflating "human" counts. */
  spoofedScannerViews: number;
  botPageViews: number;
};

export type OpsPageData = {
  pages: PageUsageRow[];
  missing: MissingPathRow[];
  quality: TrafficQuality;
};

function sinceIso(range: TimelineRange): string | null {
  const days = timelineRangeDays(range);
  if (days === null) return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString();
}

function agentSlugFromPath(path: string): string | null {
  const match = /^\/agents\/([A-Za-z0-9_-]+)$/.exec(normalizePath(path));
  return match ? match[1] : null;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

type RunRow = {
  agent_slug: string;
  runs: number;
  errors: number;
  authed_users: number;
  anon_sessions: number;
  first_run_at: string | null;
  last_run_at: string | null;
};

/** Authenticated identifiers are UUIDs; anonymous ones are opaque tokens. */
const AUTHED_IDENTIFIER = sql`rate_limit_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-'`;

/**
 * Earliest recorded pageview. Any "page views but no runs" comparison is
 * meaningless before this date, because runs predate traffic tracking by seven
 * months.
 */
export async function fetchPageViewsSince(): Promise<string | null> {
  if (!isAnalyticsDbAvailable()) return null;
  const rows = unwrapExecuteRows<{ since: string | null }>(
    await db.execute(sql`SELECT min(created_at) AS since FROM page_views`)
  );
  return toIso(rows[0]?.since);
}

type PromptRow = {
  app_name: string;
  prompts: number;
  prompt_sessions: number;
};

/**
 * Per-agent usage: runs and reliability from `agent_run_events`, demand from
 * ADK `events`, interest from `page_views`. Agents absent from all three are
 * absent here; the caller joins against the catalog to spot never-used agents.
 */
export async function fetchAgentUsage(range: TimelineRange): Promise<AgentUsageRow[]> {
  if (!isAnalyticsDbAvailable()) return [];
  const since = sinceIso(range);

  const runRows = unwrapExecuteRows<RunRow>(
    await db.execute(sql`
      SELECT
        agent_slug,
        count(*) FILTER (WHERE ${TERMINAL_RUN_FILTER})::int AS runs,
        count(*) FILTER (WHERE status = 'error')::int AS errors,
        count(DISTINCT rate_limit_identifier) FILTER (
          WHERE ${TERMINAL_RUN_FILTER} AND ${AUTHED_IDENTIFIER}
        )::int AS authed_users,
        count(DISTINCT rate_limit_identifier) FILTER (
          WHERE ${TERMINAL_RUN_FILTER}
            AND rate_limit_identifier IS NOT NULL
            AND NOT (${AUTHED_IDENTIFIER})
        )::int AS anon_sessions,
        min(created_at) FILTER (WHERE ${TERMINAL_RUN_FILTER}) AS first_run_at,
        max(created_at) FILTER (WHERE ${TERMINAL_RUN_FILTER}) AS last_run_at
      FROM agent_run_events
      ${since ? sql`WHERE created_at >= ${since}` : sql``}
      GROUP BY agent_slug
    `)
  );

  // events.timestamp is `timestamp without time zone` in UTC; cast so the
  // comparison doesn't depend on server timezone.
  const promptRows = unwrapExecuteRows<PromptRow>(
    await db.execute(sql`
      SELECT
        app_name,
        count(*)::int AS prompts,
        count(DISTINCT session_id)::int AS prompt_sessions
      FROM events
      WHERE author = 'user'
      ${since ? sql`AND timestamp >= (${since})::timestamptz AT TIME ZONE 'UTC'` : sql``}
      GROUP BY app_name
    `)
  );

  const pageViewRows = await fetchPathTotals(range);
  const viewsBySlug = new Map<string, number>();
  for (const row of pageViewRows) {
    const slug = agentSlugFromPath(row.path);
    if (slug) {
      viewsBySlug.set(slug, (viewsBySlug.get(slug) ?? 0) + row.humanViews);
    }
  }

  const promptsBySlug = new Map(promptRows.map((r) => [r.app_name, r]));
  const slugs = new Set<string>([
    ...runRows.map((r) => r.agent_slug),
    ...promptRows.map((r) => r.app_name),
    ...viewsBySlug.keys(),
  ]);

  const rows: AgentUsageRow[] = [...slugs].map((slug) => {
    const run = runRows.find((r) => r.agent_slug === slug);
    const prompt = promptsBySlug.get(slug);
    const runs = Number(run?.runs ?? 0);
    const errors = Number(run?.errors ?? 0);
    return {
      agentSlug: slug,
      runs,
      errors,
      errorRate: runs > 0 ? errors / runs : 0,
      authedUsers: Number(run?.authed_users ?? 0),
      anonSessions: Number(run?.anon_sessions ?? 0),
      prompts: Number(prompt?.prompts ?? 0),
      promptSessions: Number(prompt?.prompt_sessions ?? 0),
      pageViews: viewsBySlug.get(slug) ?? 0,
      firstRunAt: toIso(run?.first_run_at),
      lastRunAt: toIso(run?.last_run_at),
    };
  });

  return rows.sort((a, b) => b.runs - a.runs || b.pageViews - a.pageViews);
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

type PathTotalRow = {
  path: string;
  views: number;
  humanViews: number;
  botViews: number;
  visitors: number;
};

async function fetchPathTotals(range: TimelineRange): Promise<PathTotalRow[]> {
  const since = sinceIso(range);
  const rows = unwrapExecuteRows<{
    path: string;
    views: number;
    human_views: number;
    bot_views: number;
    visitors: number;
  }>(
    await db.execute(sql`
      SELECT
        path,
        count(*)::int AS views,
        count(*) FILTER (WHERE coalesce(is_bot, false) = false)::int AS human_views,
        count(*) FILTER (WHERE is_bot = true)::int AS bot_views,
        count(DISTINCT hashed_ip) FILTER (WHERE coalesce(is_bot, false) = false)::int AS visitors
      FROM page_views
      ${since ? sql`WHERE created_at >= ${since}` : sql``}
      GROUP BY path
    `)
  );

  return rows.map((r) => ({
    path: normalizePath(r.path),
    views: Number(r.views),
    humanViews: Number(r.human_views),
    botViews: Number(r.bot_views),
    visitors: Number(r.visitors),
  }));
}

async function fetchJourneyStats(range: TimelineRange): Promise<PageJourneyStat[]> {
  const since = sinceIso(range);
  const rows = unwrapExecuteRows<{ hashed_ip: string; path: string; created_at: string }>(
    await db.execute(sql`
      SELECT hashed_ip, path, created_at
      FROM page_views
      WHERE coalesce(is_bot, false) = false
        AND hashed_ip IS NOT NULL
        ${since ? sql`AND created_at >= ${since}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${RAW_VIEW_LIMIT}
    `)
  );

  // Scanners must be dropped before sessionizing, or a credential sweep from one
  // IP becomes a 40-page "visit".
  const views: RawPageView[] = [];
  for (const row of rows) {
    const path = normalizePath(row.path);
    if (classifyPath(path) !== 'page') continue;
    const at = new Date(row.created_at);
    if (Number.isNaN(at.getTime())) continue;
    views.push({ hashedIp: row.hashed_ip, path, at });
  }

  return pageJourneyStats(sessionizeVisits(views));
}

/**
 * Page traffic split by classification, with journey behaviour merged in.
 * `pages` covers real routes only; scanner noise surfaces in `quality`.
 */
export async function fetchPageUsage(range: TimelineRange): Promise<OpsPageData> {
  if (!isAnalyticsDbAvailable()) {
    return {
      pages: [],
      missing: [],
      quality: {
        totalViews: 0,
        pageViews: 0,
        scannerViews: 0,
        missingViews: 0,
        infraViews: 0,
        humanPageViews: 0,
        spoofedScannerViews: 0,
        botPageViews: 0,
      },
    };
  }

  await ensurePageViewsSchema();

  const [totals, journeys] = await Promise.all([
    fetchPathTotals(range),
    fetchJourneyStats(range),
  ]);
  const journeyByPath = new Map(journeys.map((j) => [j.path, j]));

  const quality: TrafficQuality = {
    totalViews: 0,
    pageViews: 0,
    scannerViews: 0,
    missingViews: 0,
    infraViews: 0,
    humanPageViews: 0,
    spoofedScannerViews: 0,
    botPageViews: 0,
  };

  const pages: PageUsageRow[] = [];
  const missing: MissingPathRow[] = [];

  for (const row of totals) {
    quality.totalViews += row.views;
    const kind = classifyPath(row.path);

    if (kind === 'page') {
      quality.pageViews += row.views;
      quality.humanPageViews += row.humanViews;
      quality.botPageViews += row.botViews;
      const journey = journeyByPath.get(row.path);
      pages.push({
        path: row.path,
        views: row.views,
        humanViews: row.humanViews,
        botViews: row.botViews,
        visitors: row.visitors,
        entries: journey?.entries ?? 0,
        exits: journey?.exits ?? 0,
        onwardRate: journey?.onwardRate ?? 0,
        bounces: journey?.bounces ?? 0,
      });
    } else if (kind === 'scanner') {
      quality.scannerViews += row.views;
      quality.spoofedScannerViews += row.humanViews;
    } else if (kind === 'missing') {
      quality.missingViews += row.views;
      missing.push({ path: row.path, hits: row.views, visitors: row.visitors });
    } else {
      quality.infraViews += row.views;
    }
  }

  return {
    pages: pages.sort((a, b) => b.humanViews - a.humanViews),
    missing: missing.sort((a, b) => b.visitors - a.visitors || b.hits - a.hits),
    quality,
  };
}
