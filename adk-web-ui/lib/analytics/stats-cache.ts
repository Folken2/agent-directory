import { revalidateTag } from 'next/cache';

/** Must match the tag on `getPageviewStats` in stats.ts. */
export const PAGEVIEW_STATS_TAG = 'pageview-stats';

/** At most one cache bust per instance per minute; the 15 s TTL covers the rest. */
export const STATS_BUST_INTERVAL_MS = 60_000;

let lastBustAt = 0;

/** Whether a bust is due at `now`, given the last one. Pure, for tests. */
export function bustDue(now: number, last: number, interval = STATS_BUST_INTERVAL_MS): boolean {
  return now - last >= interval;
}

/**
 * Invalidate the stats cache after a human hit. Crawlers are most of the
 * traffic; busting on every hit meant the cache never served a single read.
 */
export function bustStatsCache(now: number = Date.now()): void {
  if (!bustDue(now, lastBustAt)) return;
  lastBustAt = now;
  try {
    revalidateTag(PAGEVIEW_STATS_TAG, 'max');
  } catch (error) {
    console.warn('[analytics] stats cache revalidate failed', error);
  }
}
