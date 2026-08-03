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

export const TIMELINE_DAYS = 30;
export const TOP_AGENTS = 8;
/** How many countries the analytics page surfaces for human traffic. */
export const TOP_COUNTRIES = 5;

export type TimelineDay = {
  day: string; // YYYY-MM-DD (UTC)
  total: number;
  humans: number;
  bots: number;
};

export type AgentEngagementStat = {
  agentSlug: string;
  messages: number;
  activeMs: number;
};

export type CountryStat = {
  country: string; // ISO 3166-1 alpha-2, or 'ZZ'
  name: string;
  flag: string;
  count: number;
  /** Percent of human visits, 0–100. */
  share: number;
};

export type { BotAgentStat, BotCompanyStat };

export type PageviewStats = {
  total: number;
  humans: number;
  bots: number;
  /** Human visits only, top {@link TOP_COUNTRIES} by volume. */
  topCountries: CountryStat[];
  /** Crawlers rolled up to the company that operates them. */
  botCompanies: BotCompanyStat[];
  /** Individual crawler user agents, most active first. */
  byBot: BotAgentStat[];
  /** Consent-gated active use — empty until users Accept analytics. */
  topAgents: AgentEngagementStat[];
  timeline: TimelineDay[];
};

const EMPTY: PageviewStats = {
  total: 0,
  humans: 0,
  bots: 0,
  topCountries: [],
  botCompanies: [],
  byBot: [],
  topAgents: [],
  timeline: [],
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

export function formatActiveLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

async function fetchPageviewStatsUncached(): Promise<PageviewStats | null> {
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

    const byBot = await db
      .select({
        botName: sql<string>`coalesce(${pageViews.botName}, 'UnknownBot')`,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(eq(pageViews.isBot, true))
      .groupBy(sql`coalesce(${pageViews.botName}, 'UnknownBot')`)
      .orderBy(sql`count(*) desc`)
      .limit(100);

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (TIMELINE_DAYS - 1));

    const byDay = await db
      .select({
        day: sql<string>`to_char((${pageViews.createdAt} AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        humans: sql<number>`count(*) filter (where ${pageViews.isBot} = false)::int`,
        bots: sql<number>`count(*) filter (where ${pageViews.isBot} = true)::int`,
      })
      .from(pageViews)
      .where(gte(pageViews.createdAt, since))
      .groupBy(sql`(${pageViews.createdAt} AT TIME ZONE 'UTC')::date`)
      .orderBy(sql`(${pageViews.createdAt} AT TIME ZONE 'UTC')::date asc`);

    const topAgentRows = await db
      .select({
        agentSlug: sql<string>`coalesce(${engagementEvents.agentSlug}, 'unknown')`,
        messages: sql<number>`count(*) filter (where ${engagementEvents.eventType} = 'message_sent')::int`,
        activeMs: sql<number>`coalesce(sum(${engagementEvents.durationMs}) filter (where ${engagementEvents.eventType} = 'heartbeat'), 0)::int`,
      })
      .from(engagementEvents)
      .where(gte(engagementEvents.createdAt, since))
      .groupBy(sql`coalesce(${engagementEvents.agentSlug}, 'unknown')`)
      .orderBy(
        sql`count(*) filter (where ${engagementEvents.eventType} = 'message_sent') desc`
      )
      .limit(TOP_AGENTS);

    const timeline = buildEmptyTimeline(TIMELINE_DAYS);
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
    for (const point of timeline) {
      const hit = byDayMap.get(point.day);
      if (hit) {
        point.total = hit.total;
        point.humans = hit.humans;
        point.bots = hit.bots;
      }
    }

    const agents: BotAgentStat[] = byBot.map((r) =>
      toBotAgentStat(r.botName, Number(r.count))
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
    };
  } catch (error) {
    console.error('[analytics] stats query failed', error);
    return null;
  }
}

/**
 * Short TTL plus `revalidateTag('pageview-stats')` on each recorded visit.
 * Keeps the homepage pill / analytics page from serving a minute-old total.
 */
export const getPageviewStats = unstable_cache(
  fetchPageviewStatsUncached,
  ['pageview-stats-v6'],
  { revalidate: 15, tags: ['pageview-stats'] }
);

export function emptyPageviewStats(): PageviewStats {
  return EMPTY;
}
