/** Shared client fetch for live visit stats (bypass browser HTTP cache). */
import type { PageviewStats } from '@/lib/analytics/stats-types';
import type { TimelineRange } from '@/lib/analytics/timeline-range';
import demoStats30 from './demo-stats-30.json';

export type StatsResponse = { ok?: boolean; stats?: PageviewStats };

function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const demo = new URLSearchParams(window.location.search).get('demo');
  return demo === '1' || demo === 'prod';
}

function demoStats(range: TimelineRange): PageviewStats {
  const base = (demoStats30 as StatsResponse).stats!;
  const timeline = base.timeline ?? [];
  if (range === '30') {
    return { ...base, timelineRange: '30' };
  }
  if (range === '90') {
    // Stretch the sample series for UI review when Neon isn't wired locally.
    const extra: typeof timeline = [];
    const first = timeline[0];
    if (first) {
      for (let i = 60; i >= 1; i--) {
        const d = new Date(`${first.day}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - i);
        extra.push({
          day: d.toISOString().slice(0, 10),
          total: Math.max(0, Math.round(first.total * (0.4 + Math.random() * 0.8))),
          humans: Math.max(0, Math.round(first.humans * (0.4 + Math.random() * 0.8))),
          bots: Math.max(0, Math.round(first.bots * (0.4 + Math.random() * 0.8))),
        });
      }
    }
    return { ...base, timeline: [...extra, ...timeline], timelineRange: '90' };
  }
  return { ...base, timelineRange: 'all' };
}

/**
 * Load pageview stats. Uses no-store so a just-recorded visit is not hidden
 * behind the previous cached JSON response.
 *
 * Pass `?demo=1` on `/analytics` to preview UI with a canned snapshot
 * (useful when local DATABASE_URL isn't connected).
 */
export async function fetchPageviewStats(
  range: TimelineRange = '30'
): Promise<PageviewStats | null> {
  if (isDemoMode()) {
    return demoStats(range);
  }

  const res = await fetch(`/api/analytics/stats?range=${range}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as StatsResponse;
  const stats = data.stats ?? null;
  if (stats && !stats.timelineRange) {
    stats.timelineRange = range;
  }
  return stats;
}
