/**
 * Server-only data layer for the ops analytics dashboard.
 *
 * Sources, and why these and not `engagement_events`:
 *   - `agent_run_events` — 8 months of runs with error status. One row per
 *     status change, so runs count terminal rows only (see lib/db-agent-runs.ts).
 *     Authenticated runs stamp `rate_limit_identifier` with `users.id`.
 *   - `users` — Google sign-ins (NextAuth). Joined for the ops Users table.
 *   - `events` / `sessions` (ADK-owned) — user prompts, same Neon instance.
 *   - `page_views` — traffic, classified through `path-classify` because ~36% of
 *     apparently-human views are credential scanners spoofing browser UAs.
 *     Signed-in hits stamp `user_id` with `users.id`.
 *   - `engagement_events` — only for the goal funnel: funnel clicks are recorded
 *     for every visitor (cookieless without consent), each carrying the
 *     visit's landing page.
 *
 * Path classification and visit sessionization run in TypeScript rather than SQL
 * because the rules are richer than SQL patterns express cleanly. Path
 * cardinality is in the hundreds and view volume in the low thousands, so this
 * is cheap; `RAW_VIEW_LIMIT` caps the blast radius if traffic grows.
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { listCatalogAgentSlugs } from '@/lib/agent-catalog-client';
import { unwrapExecuteRows } from '@/lib/drizzle/unwrap-rows';
import { isAnalyticsDbAvailable } from './db-available';
import { ensurePageViewsSchema } from './ensure-schema';
import { classifyPath, normalizePath } from './path-classify';
import { buildGoalFunnel, type FunnelEvent, type GoalFunnel } from './funnel';
import { FUNNEL_EVENTS } from './engagement-input';
import { buildOpsSignals } from './signals';
import {
  pageJourneyStats,
  sessionizeVisits,
  type RawPageView,
  type Visit,
} from './visit-journeys';
import { timelineRangeDays, type TimelineRange } from './timeline-range';
import { toSignedInUserRow, type SignedInUserSqlRow } from './signed-in-users';
import type {
  AgentUsageRow,
  MissingPathRow,
  OpsDashboardSnapshot,
  PageUsageRow,
  SignedInUserRow,
  TrafficQuality,
} from './ops-types';

export type {
  AgentUsageRow,
  MissingPathRow,
  OpsDashboardSnapshot,
  PageUsageRow,
  SignedInUserRow,
  TrafficQuality,
} from './ops-types';

/**
 * Ceiling on rows pulled for sessionization (~1.6k today). Raw rows are kept
 * 90 days, so this only bites if traffic grows a lot; the newest rows win.
 */
const RAW_VIEW_LIMIT = 20_000;
const FUNNEL_EVENT_LIMIT = 20_000;

const TERMINAL_RUN_FILTER = sql`status in ('completed', 'error')`;

export type OpsPageData = {
  pages: PageUsageRow[];
  missing: MissingPathRow[];
  quality: TrafficQuality;
  /** Sessionized human visits, reused by the goal funnel. */
  visits: Visit[];
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
// Signed-in users
// ---------------------------------------------------------------------------

/**
 * Every Google sign-in, with runs and human page views in the selected range.
 * The account list is not range-filtered so dormant sign-ups stay visible;
 * usage columns (runs, views, last active) respect `range`.
 */
export async function fetchSignedInUsers(
  range: TimelineRange
): Promise<SignedInUserRow[]> {
  if (!isAnalyticsDbAvailable()) return [];
  const since = sinceIso(range);

  const rows = unwrapExecuteRows<SignedInUserSqlRow>(
    await db.execute(sql`
      SELECT
        u.id::text AS id,
        u.email,
        u.name,
        u.image,
        u.created_at,
        coalesce(pv.page_views, 0)::int AS page_views,
        coalesce(r.runs, 0)::int AS runs,
        coalesce(r.errors, 0)::int AS errors,
        coalesce(r.agents_used, 0)::int AS agents_used,
        r.agent_slugs,
        r.last_run_at,
        pv.last_view_at
      FROM users u
      LEFT JOIN (
        SELECT
          rate_limit_identifier AS user_id,
          count(*) FILTER (WHERE ${TERMINAL_RUN_FILTER})::int AS runs,
          count(*) FILTER (WHERE status = 'error')::int AS errors,
          count(DISTINCT agent_slug) FILTER (
            WHERE ${TERMINAL_RUN_FILTER}
          )::int AS agents_used,
          string_agg(DISTINCT agent_slug, ',') FILTER (
            WHERE ${TERMINAL_RUN_FILTER}
          ) AS agent_slugs,
          max(created_at) FILTER (WHERE ${TERMINAL_RUN_FILTER}) AS last_run_at
        FROM agent_run_events
        WHERE ${AUTHED_IDENTIFIER}
        ${since ? sql`AND created_at >= ${since}` : sql``}
        GROUP BY rate_limit_identifier
      ) r ON r.user_id = u.id::text
      LEFT JOIN (
        SELECT
          user_id,
          count(*) FILTER (
            WHERE coalesce(is_bot, false) = false
          )::int AS page_views,
          max(created_at) FILTER (
            WHERE coalesce(is_bot, false) = false
          ) AS last_view_at
        FROM page_views
        WHERE user_id IS NOT NULL
        ${since ? sql`AND created_at >= ${since}` : sql``}
        GROUP BY user_id
      ) pv ON pv.user_id = u.id::text
    `)
  );

  return rows
    .map(toSignedInUserRow)
    .sort((a, b) => {
      if (a.lastActiveAt && b.lastActiveAt) {
        return b.lastActiveAt.localeCompare(a.lastActiveAt);
      }
      if (a.lastActiveAt) return -1;
      if (b.lastActiveAt) return 1;
      return b.signedUpAt.localeCompare(a.signedUpAt);
    });
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

async function fetchVisits(range: TimelineRange): Promise<Visit[]> {
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

  return sessionizeVisits(views);
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
      visits: [],
    };
  }

  await ensurePageViewsSchema();

  const [totals, visits] = await Promise.all([
    fetchPathTotals(range),
    fetchVisits(range),
  ]);
  const journeys = pageJourneyStats(visits);
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
    visits,
  };
}

// ---------------------------------------------------------------------------
// Goal funnel
// ---------------------------------------------------------------------------

/** Funnel step events in range, with the landing page and visit key they carry. */
async function fetchFunnelEvents(range: TimelineRange): Promise<FunnelEvent[]> {
  const since = sinceIso(range);
  const rows = unwrapExecuteRows<{ id: string; event_type: string; path: string; metadata: string | null }>(
    await db.execute(sql`
      SELECT id, event_type, path, metadata
      FROM engagement_events
      WHERE (event_type IN (${sql.join(FUNNEL_EVENTS.map((e) => sql`${e}`), sql`, `)})
          OR event_type ~ '^contact_[a-z]+$')
        ${since ? sql`AND created_at >= ${since}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${FUNNEL_EVENT_LIMIT}
    `)
  );
  return rows.map((r) => {
    let meta: Record<string, unknown> = {};
    try {
      meta = r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : {};
    } catch {
      // malformed metadata: no landing, count the event on its own
    }
    return {
      eventType: r.event_type,
      path: normalizePath(r.path),
      landing: typeof meta.landing === 'string' ? normalizePath(meta.landing) : null,
      visit: typeof meta.visit === 'string' ? meta.visit : String(r.id),
    };
  });
}

/** Landing page → chat → builder → emailed → contact, from raw rows (≤ 90 days). */
export async function fetchGoalFunnel(range: TimelineRange, pageData: OpsPageData): Promise<GoalFunnel> {
  const events = isAnalyticsDbAvailable() ? await fetchFunnelEvents(range) : [];
  return buildGoalFunnel({
    visitLandings: pageData.visits.map((v) => v.paths[0]),
    events,
    pageViews: new Map(pageData.pages.map((p) => [p.path, p.humanViews])),
  });
}

// ---------------------------------------------------------------------------
// Ops dashboard snapshot (API)
// ---------------------------------------------------------------------------

/**
 * Full ops payload for `/api/analytics/ops`.
 * Signals use all-time agent last-run so "dead for 90d" is not warped by the
 * Explorer timeline filter; Explorer tables use the selected `range`.
 */
export async function fetchOpsDashboard(
  range: TimelineRange
): Promise<OpsDashboardSnapshot> {
  const catalogSlugs = listCatalogAgentSlugs();
  const [agents, agentsAll, users, pageData, pageViewsSince] =
    await Promise.all([
      fetchAgentUsage(range),
      fetchAgentUsage('all'),
      fetchSignedInUsers(range),
      fetchPageUsage(range),
      fetchPageViewsSince(),
    ]);
  const funnel = await fetchGoalFunnel(range, pageData);

  const signals = buildOpsSignals({
    catalogSlugs,
    agents: agentsAll,
    pages: pageData.pages,
    missing: pageData.missing,
    quality: pageData.quality,
    pageViewsSince,
  });

  return {
    range,
    agents,
    users,
    pages: pageData.pages,
    missing: pageData.missing,
    quality: pageData.quality,
    funnel,
    pageViewsSince,
    signals,
    catalogSlugs,
  };
}
