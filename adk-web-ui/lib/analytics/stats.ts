import { unstable_cache } from 'next/cache';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { engagementEvents } from '@/lib/drizzle/schema/engagement-events';
import {
  rollUpBotCompanies,
  toBotAgentStat,
  type BotAgentStat,
  type BotCompanyStat,
} from './bot-companies';
import { countryFlag, countryName } from './countries';
import { isAnalyticsDbAvailable } from './db-available';
import { ensurePageViewsSchema } from './ensure-schema';
import { resolveStoredBotName } from './bots';
import { isPageView, normalizePath } from './path-classify';
import { unwrapExecuteRows } from '@/lib/drizzle/unwrap-rows';
import {
  type TimelineRange,
  timelineRangeDays,
} from './timeline-range';
import {
  formatActiveLabel,
  type AgentEngagementStat,
  type CountryStat,
  type PageviewStats,
  type PeriodTotals,
  type TimelineDay,
} from './stats-types';
import { pageLabel, rankShares, referrerSource } from './dashboard-math';

/** @deprecated Prefer TimelineRange — kept for older imports. */
export const TIMELINE_DAYS = 30;
export const TOP_AGENTS = 8;
/** How many countries the analytics page surfaces for human traffic. */
export const TOP_COUNTRIES = 6;
export const TOP_PAGES = 6;
export const TOP_SOURCES = 6;

export type { TimelineRange };
export type {
  AgentEngagementStat,
  BotAgentStat,
  BotCompanyStat,
  CountryStat,
  PageviewStats,
  TimelineDay,
};
export { formatActiveLabel };

const EMPTY: PageviewStats = {
  total: 0,
  humans: 0,
  bots: 0,
  visits: 0,
  peopleApprox: 0,
  returning: 0,
  previous: null,
  topCountries: [],
  topPages: [],
  topSources: [],
  devices: [],
  botCompanies: [],
  byBot: [],
  topAgents: [],
  timeline: [],
  timelineRange: '30',
};

function utcDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function share(count: number, of: number): number {
  if (of <= 0) return 0;
  return Math.round((count / of) * 1000) / 10;
}

function buildEmptyTimeline(days: number): TimelineDay[] {
  const out: TimelineDay[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setUTCDate(now.getUTCDate() - i);
    out.push({ day: utcDayString(day), total: 0, humans: 0, bots: 0 });
  }
  return out;
}

function buildTimelineBetween(startDay: string, endDay: string): TimelineDay[] {
  const out: TimelineDay[] = [];
  const cur = new Date(`${startDay}T00:00:00.000Z`);
  const end = new Date(`${endDay}T00:00:00.000Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) {
    return buildEmptyTimeline(1);
  }
  while (cur <= end) {
    out.push({ day: utcDayString(cur), total: 0, humans: 0, bots: 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function fillTimeline(
  skeleton: TimelineDay[],
  byDayMap: Map<string, { total: number; humans: number; bots: number }>
): TimelineDay[] {
  for (const point of skeleton) {
    const hit = byDayMap.get(point.day);
    if (hit) {
      point.total = hit.total;
      point.humans = hit.humans;
      point.bots = hit.bots;
    }
  }
  return skeleton;
}

/** Half-open [from, to) window in ISO strings; null bounds are open. */
type Window = { from: string | null; to: string | null };

function windowFor(range: TimelineRange, now = new Date()): { current: Window; previous: Window | null } {
  const days = timelineRangeDays(range);
  if (days === null) return { current: { from: null, to: null }, previous: null };
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - days);
  return {
    current: { from: start.toISOString(), to: null },
    previous: { from: prevStart.toISOString(), to: start.toISOString() },
  };
}

function whereIn(w: Window, extra?: ReturnType<typeof sql>) {
  const parts = [
    w.from ? sql`created_at >= ${w.from}` : null,
    w.to ? sql`created_at < ${w.to}` : null,
    extra ?? null,
  ].filter((p): p is ReturnType<typeof sql> => p !== null);
  return parts.length ? sql`WHERE ${sql.join(parts, sql` AND `)}` : sql``;
}

const HUMAN = sql`coalesce(is_bot, false) = false`;

/** Hosts whose referrers count as internal navigation, not a traffic source. */
function ownHosts(): string[] {
  const hosts = ['localhost', '127.0.0.1'];
  for (const raw of [process.env.NEXT_PUBLIC_BASE_URL, 'https://agentdirectory.folch.ai', process.env.VERCEL_URL]) {
    if (!raw) continue;
    try {
      hosts.push(new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, ''));
    } catch {
      // ignore malformed env
    }
  }
  return hosts;
}

/** Headline counts for one window (used for the current and the previous period). */
async function windowTotals(w: Window): Promise<PeriodTotals> {
  const pathRows = unwrapExecuteRows<{ path: string; humans: number; bots: number }>(
    await db.execute(sql`
      SELECT path,
        count(*) FILTER (WHERE ${HUMAN})::int AS humans,
        count(*) FILTER (WHERE is_bot = true)::int AS bots
      FROM page_views ${whereIn(w)}
      GROUP BY path
    `)
  );
  let visits = 0;
  let crawls = 0;
  for (const row of pathRows) {
    crawls += Number(row.bots);
    if (isPageView(normalizePath(row.path))) visits += Number(row.humans);
  }

  // Distinct hashed_ip on real pages only (IP-based people estimate).
  const ipRows = unwrapExecuteRows<{ hashed_ip: string; path: string }>(
    await db.execute(sql`
      SELECT DISTINCT hashed_ip, path FROM page_views
      ${whereIn(w, sql`${HUMAN} AND hashed_ip IS NOT NULL`)}
    `)
  );
  const people = new Set<string>();
  for (const row of ipRows) if (isPageView(row.path)) people.add(row.hashed_ip);

  // Returning = persistent visitor_id with >1 human page view in the window.
  const visitorRows = unwrapExecuteRows<{ visitor_id: string; path: string; hits: number }>(
    await db.execute(sql`
      SELECT visitor_id, path, count(*)::int AS hits FROM page_views
      ${whereIn(w, HUMAN)}
      GROUP BY visitor_id, path
    `)
  );
  const hitsByVisitor = new Map<string, number>();
  for (const row of visitorRows) {
    if (!isPageView(row.path)) continue;
    hitsByVisitor.set(row.visitor_id, (hitsByVisitor.get(row.visitor_id) ?? 0) + Number(row.hits));
  }
  let returning = 0;
  for (const hits of hitsByVisitor.values()) if (hits > 1) returning++;

  return { visits, peopleApprox: people.size, returning, bots: crawls };
}

async function fetchPageviewStatsUncached(
  range: TimelineRange
): Promise<PageviewStats | null> {
  if (!isAnalyticsDbAvailable()) return null;

  try {
    await ensurePageViewsSchema();
    const { current, previous } = windowFor(range);

    const [totals, previousTotals] = await Promise.all([
      windowTotals(current),
      previous ? windowTotals(previous) : Promise.resolve(null),
    ]);

    // Human breakdowns in one pass: path × country × device × referrer host.
    const humanRows = unwrapExecuteRows<{
      path: string;
      country: string;
      device: string;
      ref_host: string | null;
      hits: number;
    }>(
      await db.execute(sql`
        SELECT
          path,
          coalesce(nullif(country, ''), 'ZZ') AS country,
          coalesce(nullif(device_type, ''), 'unknown') AS device,
          substring(referrer from '^[a-zA-Z][a-zA-Z0-9+.-]*://([^/?#:]+)') AS ref_host,
          count(*)::int AS hits
        FROM page_views
        ${whereIn(current, HUMAN)}
        GROUP BY 1, 2, 3, 4
      `)
    );

    const countryCounts = new Map<string, number>();
    const pageCounts = new Map<string, number>();
    const sourceCounts = new Map<string, { label: string; count: number }>();
    const deviceCounts = new Map<string, number>();
    const own = ownHosts();
    for (const row of humanRows) {
      const path = normalizePath(row.path);
      if (!isPageView(path)) continue;
      const hits = Number(row.hits);
      countryCounts.set(row.country, (countryCounts.get(row.country) ?? 0) + hits);
      pageCounts.set(path, (pageCounts.get(path) ?? 0) + hits);
      const src = referrerSource(row.ref_host ? `https://${row.ref_host}/` : null, own);
      const prev = sourceCounts.get(src.id);
      sourceCounts.set(src.id, { label: src.label, count: (prev?.count ?? 0) + hits });
      deviceCounts.set(row.device, (deviceCounts.get(row.device) ?? 0) + hits);
    }

    const botUaRows = unwrapExecuteRows<{
      bot_name: string | null;
      user_agent: string | null;
      count: number;
    }>(
      await db.execute(sql`
        SELECT
          coalesce(bot_name, 'UnknownBot') AS bot_name,
          user_agent,
          count(*)::int AS count
        FROM page_views
        ${whereIn(current, sql`is_bot = true`)}
        GROUP BY coalesce(bot_name, 'UnknownBot'), user_agent
        ORDER BY count(*) DESC
        LIMIT 500
      `)
    );

    const botCounts = new Map<string, number>();
    for (const row of botUaRows) {
      const name = resolveStoredBotName(row.bot_name, row.user_agent);
      botCounts.set(name, (botCounts.get(name) ?? 0) + Number(row.count));
    }
    const byBotSorted = [...botCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    const botTotal = byBotSorted.reduce((sum, [, n]) => sum + n, 0);

    const byDayRaw = unwrapExecuteRows<{
      day: string;
      path: string;
      total: number;
      humans: number;
      bots: number;
    }>(
      await db.execute(sql`
        SELECT
          to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
          path,
          count(*)::int AS total,
          count(*) FILTER (WHERE ${HUMAN})::int AS humans,
          count(*) FILTER (WHERE is_bot = true)::int AS bots
        FROM page_views
        ${whereIn(current)}
        GROUP BY (created_at AT TIME ZONE 'UTC')::date, path
        ORDER BY (created_at AT TIME ZONE 'UTC')::date ASC
      `)
    );

    // Daily human visits count real pages only; crawls count every bot hit,
    // matching the crawler total.
    const byDayMap = new Map<string, { total: number; humans: number; bots: number }>();
    for (const row of byDayRaw) {
      const prev = byDayMap.get(row.day) ?? { total: 0, humans: 0, bots: 0 };
      const humans = isPageView(normalizePath(row.path)) ? Number(row.humans) : 0;
      prev.humans += humans;
      prev.bots += Number(row.bots);
      prev.total = prev.humans + prev.bots;
      byDayMap.set(row.day, prev);
    }

    const engagementWhere = current.from ? sql`${engagementEvents.createdAt} >= ${current.from}` : sql`true`;
    const topAgentRows = await db
      .select({
        agentSlug: sql<string>`coalesce(${engagementEvents.agentSlug}, 'unknown')`,
        messages: sql<number>`count(*) filter (where ${engagementEvents.eventType} = 'message_sent')::int`,
        activeMs: sql<number>`coalesce(sum(${engagementEvents.durationMs}) filter (where ${engagementEvents.eventType} = 'heartbeat'), 0)::int`,
      })
      .from(engagementEvents)
      .where(engagementWhere)
      .groupBy(sql`coalesce(${engagementEvents.agentSlug}, 'unknown')`)
      .orderBy(
        sql`count(*) filter (where ${engagementEvents.eventType} = 'message_sent') desc`
      )
      .limit(TOP_AGENTS);

    const fixedDays = timelineRangeDays(range);
    const today = utcDayString(new Date());
    let timeline: TimelineDay[];
    if (fixedDays !== null) {
      timeline = fillTimeline(buildEmptyTimeline(fixedDays), byDayMap);
    } else if (byDayMap.size === 0) {
      timeline = buildEmptyTimeline(1);
    } else {
      const days = [...byDayMap.keys()].sort();
      timeline = fillTimeline(buildTimelineBetween(days[0], today), byDayMap);
    }

    const agents: BotAgentStat[] = byBotSorted.map(([botName, count]) =>
      toBotAgentStat(botName, count)
    );

    const visits = totals.visits;
    const topCountries = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_COUNTRIES)
      .map(([country, count]) => ({
        country,
        name: countryName(country),
        flag: countryFlag(country),
        count,
        share: share(count, visits),
      }));

    return {
      total: visits + botTotal,
      humans: visits,
      bots: botTotal,
      visits,
      peopleApprox: totals.peopleApprox,
      returning: totals.returning,
      previous: previousTotals,
      topCountries,
      topPages: rankShares(
        [...pageCounts.entries()].map(([path, count]) => ({ id: path, label: pageLabel(path), count })),
        TOP_PAGES,
      ),
      topSources: rankShares(
        [...sourceCounts.entries()].map(([id, v]) => ({ id, label: v.label, count: v.count })),
        TOP_SOURCES,
      ),
      devices: rankShares(
        [...deviceCounts.entries()].map(([id, count]) => ({ id, label: deviceLabel(id), count })),
        4,
      ),
      botCompanies: rollUpBotCompanies(agents, botTotal),
      byBot: agents,
      topAgents: topAgentRows
        .map((r) => ({
          agentSlug: r.agentSlug,
          messages: Number(r.messages),
          activeMs: Number(r.activeMs),
        }))
        .filter((r) => r.messages > 0 || r.activeMs > 0),
      timeline,
      timelineRange: range,
    };
  } catch (error) {
    console.error('[analytics] stats query failed', error);
    return null;
  }
}

function deviceLabel(id: string): string {
  const labels: Record<string, string> = { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', unknown: 'Unknown' };
  return labels[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

const getCachedPageviewStats = unstable_cache(
  async (range: TimelineRange) => fetchPageviewStatsUncached(range),
  ['pageview-stats-v9'],
  { revalidate: 15, tags: ['pageview-stats'] }
);

/**
 * Short TTL plus `revalidateTag('pageview-stats')` on each recorded visit.
 * Keeps the homepage pill / analytics page from serving a minute-old total.
 * Every figure is scoped to `range`; `previous` holds the same counts for the
 * preceding window of equal length (null for all-time).
 */
export async function getPageviewStats(
  range: TimelineRange = '30'
): Promise<PageviewStats | null> {
  return getCachedPageviewStats(range);
}

export function emptyPageviewStats(
  range: TimelineRange = '30'
): PageviewStats {
  return { ...EMPTY, timelineRange: range };
}
