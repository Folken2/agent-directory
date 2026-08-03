/** Shared client fetch for live visit stats (bypass browser HTTP cache). */
import type { PageviewStats } from '@/lib/analytics/stats';

export type StatsResponse = { ok?: boolean; stats?: PageviewStats };

/**
 * Load pageview stats. Uses no-store so a just-recorded visit is not hidden
 * behind the previous cached JSON response.
 */
export async function fetchPageviewStats(): Promise<PageviewStats | null> {
  const res = await fetch('/api/analytics/stats', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as StatsResponse;
  return data.stats ?? null;
}
