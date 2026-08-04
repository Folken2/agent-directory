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
  type TimelineDay,
} from './stats-types';

/** @deprecated Prefer TimelineRange — kept for older imports. */
export const TIMELINE_DAYS = 30;
export const TOP_AGENTS = 8;
/** How many countries the analytics page surfaces for human traffic. */
export const TOP_COUNTRIES = 5;

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
  topCountries: [],
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

async function fetchPageviewStatsUncached(
  range: TimelineRange
): Promise<PageviewStats | null> {
  if (!isAnalyticsDbAvailable()) return null;

  try {
    await ensurePageViewsSchema();

    // Path-level rollup so we can drop scanner / infra / missing from public
    // "people" and visit counts (classification is richer than SQL patterns).
    const pathRows = unwrapExecuteRows<{
      path: string;
      total: number;
      humans: number;
      bots: number;
      country: string | null;
    }>(
      await db.execute(sql`
        SELECT
          path,
          coalesce(nullif(country, ''), 'ZZ') AS country,
          count(*)::int AS total,
          count(*) FILTER (WHERE coalesce(is_bot, false) = false)::int AS humans,
          count(*) FILTER (WHERE is_bot = true)::int AS bots
        FROM page_views
        GROUP BY path, coalesce(nullif(country, ''), 'ZZ')
      `)
    );

    let visits = 0;
    let total = 0;
    const countryCounts = new Map<string, number>();

    for (const row of pathRows) {
      const path = normalizePath(row.path);
      const rowTotal = Number(row.total);
      const rowHumans = Number(row.humans);
      total += rowTotal;

      if (!isPageView(path)) continue;

      visits += rowHumans;
      if (rowHumans > 0) {
        const c = row.country || 'ZZ';
        countryCounts.set(c, (countryCounts.get(c) ?? 0) + rowHumans);
      }
    }

    // Distinct hashed_ip on real pages only (IP-based people estimate).
    const ipRows = unwrapExecuteRows<{ hashed_ip: string; path: string }>(
      await db.execute(sql`
        SELECT DISTINCT hashed_ip, path
        FROM page_views
        WHERE coalesce(is_bot, false) = false
          AND hashed_ip IS NOT NULL
      `)
    );
    const peopleSet = new Set<string>();
    for (const row of ipRows) {
      if (isPageView(row.path)) peopleSet.add(row.hashed_ip);
    }

    // Returning = persistent visitor_id with >1 human page view (ephemeral
    // one-shot UUIDs never qualify).
    const visitorRows = unwrapExecuteRows<{
      visitor_id: string;
      path: string;
      hits: number;
    }>(
      await db.execute(sql`
        SELECT visitor_id, path, count(*)::int AS hits
        FROM page_views
        WHERE coalesce(is_bot, false) = false
        GROUP BY visitor_id, path
      `)
    );
    const hitsByVisitor = new Map<string, number>();
    for (const row of visitorRows) {
      if (!isPageView(row.path)) continue;
      hitsByVisitor.set(
        row.visitor_id,
        (hitsByVisitor.get(row.visitor_id) ?? 0) + Number(row.hits)
      );
    }
    let returning = 0;
    for (const hits of hitsByVisitor.values()) {
      if (hits > 1) returning++;
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
        WHERE is_bot = true
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

    const botTotal = byBotSorted.reduce((s, [, n]) => s + n, 0);

    const fixedDays = timelineRangeDays(range);
    const since =
      fixedDays === null
        ? null
        : (() => {
            const d = new Date();
            d.setUTCHours(0, 0, 0, 0);
            d.setUTCDate(d.getUTCDate() - (fixedDays - 1));
            return d.toISOString();
          })();

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
          count(*) FILTER (WHERE coalesce(is_bot, false) = false)::int AS humans,
          count(*) FILTER (WHERE is_bot = true)::int AS bots
        FROM page_views
        ${since ? sql`WHERE created_at >= ${since}` : sql``}
        GROUP BY (created_at AT TIME ZONE 'UTC')::date, path
        ORDER BY (created_at AT TIME ZONE 'UTC')::date ASC
      `)
    );

    const byDayMap = new Map<
      string,
      { total: number; humans: number; bots: number }
    >();
    for (const row of byDayRaw) {
      if (!isPageView(row.path)) continue;
      const prev = byDayMap.get(row.day) ?? { total: 0, humans: 0, bots: 0 };
      prev.total += Number(row.total);
      prev.humans += Number(row.humans);
      prev.bots += Number(row.bots);
      byDayMap.set(row.day, prev);
    }

    // Engagement is all-time — independent of the chart window.
    const topAgentRows = await db
      .select({
        agentSlug: sql<string>`coalesce(${engagementEvents.agentSlug}, 'unknown')`,
        messages: sql<number>`count(*) filter (where ${engagementEvents.eventType} = 'message_sent')::int`,
        activeMs: sql<number>`coalesce(sum(${engagementEvents.durationMs}) filter (where ${engagementEvents.eventType} = 'heartbeat'), 0)::int`,
      })
      .from(engagementEvents)
      .groupBy(sql`coalesce(${engagementEvents.agentSlug}, 'unknown')`)
      .orderBy(
        sql`count(*) filter (where ${engagementEvents.eventType} = 'message_sent') desc`
      )
      .limit(TOP_AGENTS);

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
      total,
      humans: visits,
      bots: botTotal,
      visits,
      peopleApprox: peopleSet.size,
      returning,
      topCountries,
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

const getCachedPageviewStats = unstable_cache(
  async (range: TimelineRange) => fetchPageviewStatsUncached(range),
  ['pageview-stats-v8'],
  { revalidate: 15, tags: ['pageview-stats'] }
);

/**
 * Short TTL plus `revalidateTag('pageview-stats')` on each recorded visit.
 * Keeps the homepage pill / analytics page from serving a minute-old total.
 * `range` only affects `timeline`; totals and rankings stay all-time.
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
