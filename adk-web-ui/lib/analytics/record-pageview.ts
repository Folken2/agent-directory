import { and, eq, gte } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { db } from '@/lib/drizzle/db';
import { pageViews, type NewPageView } from '@/lib/drizzle/schema/page-views';
import { identifyBot } from './bots';
import { isAnalyticsDbAvailable } from './db-available';
import { ensurePageViewsSchema } from './ensure-schema';
import { extractClientIp, hashIp } from './hash-ip';
import { parseUserAgent } from './parse-ua';
import {
  extractUtm,
  sanitizeQuery,
  shouldTrackPath,
} from './should-track';

/** Must match the tag on `getPageviewStats` in stats.ts. */
const PAGEVIEW_STATS_TAG = 'pageview-stats';

const DEDUPE_WINDOW_MS = 5_000;

export type PageviewInput = {
  path: string;
  query?: string | null;
  referrer?: string | null;
  visitorId: string;
  userId?: string | null;
  userAgent?: string | null;
  language?: string | null;
  source: 'server' | 'client';
  country?: string | null;
  region?: string | null;
  city?: string | null;
  headers?: Headers;
  force?: boolean;
};

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

export async function recordPageview(input: PageviewInput): Promise<{
  recorded: boolean;
  reason?: string;
  id?: string;
}> {
  if (!isAnalyticsDbAvailable()) {
    return { recorded: false, reason: 'no_database' };
  }

  try {
    await ensurePageViewsSchema();
  } catch (error) {
    console.error('[analytics] schema ensure failed', error);
    return { recorded: false, reason: 'db_error' };
  }

  const path = input.path.split('?')[0] || '/';
  if (!shouldTrackPath(path)) {
    return { recorded: false, reason: 'skipped_path' };
  }

  if (!input.visitorId) {
    return { recorded: false, reason: 'missing_visitor' };
  }

  const headers = input.headers;
  const userAgent = truncate(input.userAgent ?? headers?.get('user-agent'), 1024);
  const language = input.language ?? headers?.get('accept-language');
  const bot = identifyBot(userAgent, {
    language,
    source: input.source,
    headers,
  });
  const ua = parseUserAgent(userAgent, bot.isBot);
  const query = sanitizeQuery(input.query ?? '');
  const utm = extractUtm(input.query ?? query);

  const country =
    input.country ?? headers?.get('x-vercel-ip-country') ?? null;
  const region =
    input.region ?? headers?.get('x-vercel-ip-country-region') ?? null;
  const city = input.city ?? headers?.get('x-vercel-ip-city') ?? null;

  const ip = headers ? extractClientIp(headers) : null;
  const hashedIp = hashIp(ip);

  const row: NewPageView = {
    path,
    query,
    referrer: truncate(input.referrer, 2048),
    country: truncate(country, 8),
    region: truncate(region, 64),
    city: truncate(city ? decodeURIComponent(city) : null, 128),
    hashedIp,
    visitorId: input.visitorId,
    userId: input.userId ?? null,
    userAgent,
    isBot: bot.isBot,
    botName: bot.botName,
    botCategory: bot.botCategory,
    botConfidence: bot.confidence,
    botSignals: bot.signals.length ? bot.signals.join(',') : null,
    browser: ua.browser,
    os: ua.os,
    deviceType: ua.deviceType,
    language: truncate(language, 64),
    utmSource: utm.utmSource,
    utmMedium: utm.utmMedium,
    utmCampaign: utm.utmCampaign,
    utmTerm: utm.utmTerm,
    utmContent: utm.utmContent,
    source: input.source,
  };

  try {
    if (!input.force) {
      const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
      const recent = await db
        .select({ id: pageViews.id })
        .from(pageViews)
        .where(
          and(
            eq(pageViews.visitorId, input.visitorId),
            eq(pageViews.path, path),
            gte(pageViews.createdAt, since)
          )
        )
        .limit(1);

      if (recent.length > 0) {
        return { recorded: false, reason: 'deduped', id: recent[0].id };
      }
    }

    const inserted = await db.insert(pageViews).values(row).returning({ id: pageViews.id });
    // Bust the 60s stats cache so homepage pill /analytics show the new visit.
    try {
      revalidateTag(PAGEVIEW_STATS_TAG, 'max');
    } catch (error) {
      console.warn('[analytics] stats cache revalidate failed', error);
    }
    return { recorded: true, id: inserted[0]?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOTFOUND|getaddrinfo|connect|password authentication/i.test(message)) {
      console.warn('[analytics] database unavailable; pageview not recorded');
    } else {
      console.error('[analytics] failed to record pageview', error);
    }
    return { recorded: false, reason: 'db_error' };
  }
}
