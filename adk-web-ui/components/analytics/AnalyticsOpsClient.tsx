'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OpsDashboardSnapshot } from '@/lib/analytics/ops-types';
import type { TimelineRange } from '@/lib/analytics/timeline-range';
import OpsSignals from '@/components/analytics/OpsSignals';
import OpsExplorer from '@/components/analytics/OpsExplorer';
import OpsGa4Panel from '@/components/analytics/OpsGa4Panel';

export default function AnalyticsOpsClient() {
  const [range, setRange] = useState<TimelineRange>('30');
  const [data, setData] = useState<OpsDashboardSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange: TimelineRange) => {
    setLoaded(false);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/ops?range=${nextRange}`, {
        cache: 'no-store',
      });
      if (res.status === 404) {
        setError('not_found');
        setData(null);
        return;
      }
      if (!res.ok) {
        setError('unavailable');
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json.data ?? null);
    } catch {
      setError('unavailable');
      setData(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  if (!loaded && !data) {
    return (
      <p className="text-body-medium text-md-on-surface-variant">Loading…</p>
    );
  }

  if (error === 'not_found') {
    return (
      <p className="text-body-medium text-md-on-surface-variant">Not found.</p>
    );
  }

  if (!data) {
    return (
      <p className="text-body-medium text-md-on-surface-variant">
        Ops metrics unavailable.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <OpsSignals signals={data.signals} />
      <OpsExplorer
        range={range}
        onRangeChange={setRange}
        agents={data.agents}
        pages={data.pages}
        missing={data.missing}
        quality={data.quality}
        themes={data.themes}
      />
      <OpsGa4Panel range={range} />
    </div>
  );
}
