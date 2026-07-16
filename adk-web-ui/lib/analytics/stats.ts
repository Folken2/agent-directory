import { unstable_cache } from 'next/cache';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { pageViews } from '@/lib/drizzle/schema/page-views';
import { isAnalyticsDbAvailable } from './db-available';

export type PageviewStats = {
  total: number;
  humans: number;
  bots: number;
  byCountry: { country: string; label?: string; count: number }[];
  byBot: { botName: string; category?: string; count: number }[];
};

const EMPTY: PageviewStats = {
  total: 0,
  humans: 0,
  bots: 0,
  byCountry: [],
  byBot: [],
};

async function fetchPageviewStatsUncached(): Promise<PageviewStats | null> {
  if (!isAnalyticsDbAvailable()) return null;

  try {
    const [totals] = await db
      .select({
        total: sql<number>`count(*)::int`,
        humans: sql<number>`count(*) filter (where ${pageViews.isBot} = false)::int`,
        bots: sql<number>`count(*) filter (where ${pageViews.isBot} = true)::int`,
      })
      .from(pageViews);

    const byCountry = await db
      .select({
        country: sql<string>`coalesce(${pageViews.country}, 'ZZ')`,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .groupBy(sql`coalesce(${pageViews.country}, 'ZZ')`)
      .orderBy(sql`count(*) desc`)
      .limit(50);

    const byBot = await db
      .select({
        botName: sql<string>`coalesce(${pageViews.botName}, 'UnknownBot')`,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(eq(pageViews.isBot, true))
      .groupBy(sql`coalesce(${pageViews.botName}, 'UnknownBot')`)
      .orderBy(sql`count(*) desc`)
      .limit(50);

    return {
      total: Number(totals?.total ?? 0),
      humans: Number(totals?.humans ?? 0),
      bots: Number(totals?.bots ?? 0),
      byCountry: byCountry.map((r) => ({
        country: r.country,
        count: Number(r.count),
      })),
      byBot: byBot.map((r) => ({
        botName: r.botName,
        count: Number(r.count),
      })),
    };
  } catch (error) {
    console.error('[analytics] stats query failed', error);
    return null;
  }
}

/** Cached 60s — safe for homepage pill + analytics page. */
export const getPageviewStats = unstable_cache(
  fetchPageviewStatsUncached,
  ['pageview-stats-v1'],
  { revalidate: 60, tags: ['pageview-stats'] }
);

export function emptyPageviewStats(): PageviewStats {
  return EMPTY;
}
