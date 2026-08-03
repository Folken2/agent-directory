import { unstable_cache } from 'next/cache';
import { eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { pageViews } from '@/lib/drizzle/schema/page-views';
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

    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        humans: sql<number>`count(*) filter (where ${pageViews.isBot} = false)::int`,
        bots: sql<number>`count(*) filter (where ${pageViews.isBot} = true)::int`,
      })
      .from(pageViews);

    const humanTotal = Number(totals?.humans ?? 0);
    const botTotal = Number(totals?.bots ?? 0);

    // Countries: humans only — bot geo says where the crawler egresses, not who read us.
    const byCountry = await db
      .select({
        country: sql<string>`coalesce(nullif(${pageViews.country}, ''), 'ZZ')`,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(eq(pageViews.isBot, false))
      .groupBy(sql`coalesce(nullif(${pageViews.country}, ''), 'ZZ')`)
      .orderBy(sql`count(*) desc`)
      .limit(TOP_COUNTRIES);

    const botUaRows = await db
      .select({
        botName: sql<string>`coalesce(${pageViews.botName}, 'UnknownBot')`,
        userAgent: pageViews.userAgent,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(eq(pageViews.isBot, true))
      .groupBy(sql`coalesce(${pageViews.botName}, 'UnknownBot')`, pageViews.userAgent)
      .orderBy(sql`count(*) desc`)
      .limit(500);

    const botCounts = new Map<string, number>();
    for (const row of botUaRows) {
      const name = resolveStoredBotName(row.botName, row.userAgent);
      botCounts.set(name, (botCounts.get(name) ?? 0) + Number(row.count));
    }
    const byBotSorted = [...botCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);

    const fixedDays = timelineRangeDays(range);
    const since =
      fixedDays === null
        ? null
        : (() => {
            const d = new Date();
            d.setUTCHours(0, 0, 0, 0);
            d.setUTCDate(d.getUTCDate() - (fixedDays - 1));
            return d;
          })();

    const byDayQuery = db
      .select({
        day: sql<string>`to_char((${pageViews.createdAt} AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        humans: sql<number>`count(*) filter (where ${pageViews.isBot} = false)::int`,
        bots: sql<number>`count(*) filter (where ${pageViews.isBot} = true)::int`,
      })
      .from(pageViews);

    const byDay =
      since === null
        ? await byDayQuery
            .groupBy(sql`(${pageViews.createdAt} AT TIME ZONE 'UTC')::date`)
            .orderBy(sql`(${pageViews.createdAt} AT TIME ZONE 'UTC')::date asc`)
        : await byDayQuery
            .where(gte(pageViews.createdAt, since))
            .groupBy(sql`(${pageViews.createdAt} AT TIME ZONE 'UTC')::date`)
            .orderBy(sql`(${pageViews.createdAt} AT TIME ZONE 'UTC')::date asc`);

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

    const byDayMap = new Map(
      byDay.map((r) => [
        r.day,
        {
          total: Number(r.total),
          humans: Number(r.humans),
          bots: Number(r.bots),
        },
      ])
    );

    const today = utcDayString(new Date());
    let timeline: TimelineDay[];
    if (fixedDays !== null) {
      timeline = fillTimeline(buildEmptyTimeline(fixedDays), byDayMap);
    } else if (byDay.length === 0) {
      timeline = buildEmptyTimeline(1);
    } else {
      timeline = fillTimeline(
        buildTimelineBetween(byDay[0].day, today),
        byDayMap
      );
    }

    const agents: BotAgentStat[] = byBotSorted.map(([botName, count]) =>
      toBotAgentStat(botName, count)
    );

    return {
      total: Number(totals?.total ?? 0),
      humans: humanTotal,
      bots: botTotal,
      topCountries: byCountry.map((r) => ({
        country: r.country,
        name: countryName(r.country),
        flag: countryFlag(r.country),
        count: Number(r.count),
        share: share(Number(r.count), humanTotal),
      })),
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
  ['pageview-stats-v7'],
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
