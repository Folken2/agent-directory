'use client';

import { useEffect, useState } from 'react';
import type { PageviewStats } from '@/lib/analytics/stats-types';
import { fetchPageviewStats } from '@/lib/analytics/fetch-stats-client';
import type { TimelineRange } from '@/lib/analytics/timeline-range';

/**
 * Delay before a second stats pull so middleware/client pageview ingest
 * can land and bust the stats cache before we paint the final count.
 */
const FOLLOW_UP_MS = 1200;

/**
 * Live pageview stats with a short follow-up refetch.
 * First paint may still race the concurrent pageview; the follow-up picks it up
 * without requiring a manual refresh.
 */
export function usePageviewStats(range: TimelineRange = '30'): {
  stats: PageviewStats | null;
  loaded: boolean;
} {
  const [stats, setStats] = useState<PageviewStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    const load = async () => {
      try {
        const next = await fetchPageviewStats(range);
        if (!cancelled) {
          setStats(next);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setStats(null);
          setLoaded(true);
        }
      }
    };

    void load();
    const timer = window.setTimeout(() => {
      void load();
    }, FOLLOW_UP_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [range]);

  return { stats, loaded };
}
