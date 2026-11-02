'use client';

import { useEffect, useState } from 'react';
import type { OpsDashboardSnapshot } from '@/lib/analytics/ops-types';
import type { TimelineRange } from '@/lib/analytics/timeline-range';
import OpsSignals from '@/components/analytics/OpsSignals';
import OpsExplorer from '@/components/analytics/OpsExplorer';
import OpsFunnelPanel from '@/components/analytics/OpsFunnelPanel';
import OpsGa4Panel from '@/components/analytics/OpsGa4Panel';
import OpsSearchConsolePanel from '@/components/analytics/OpsSearchConsolePanel';
import { ListSkeleton } from '@/components/layout/PageSkeletons';

type Loaded = { range: TimelineRange; data: OpsDashboardSnapshot | null; error: 'not_found' | 'unavailable' | null };

/** Signals, the goal funnel, the Explorer tables, Search Console and (when configured) GA4. */
export default function AnalyticsOpsClient({ range }: { range: TimelineRange }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics/ops?range=${range}`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setLoaded({ range, data: null, error: 'not_found' });
        if (!res.ok) return setLoaded({ range, data: null, error: 'unavailable' });
        const json = await res.json();
        if (!cancelled) setLoaded({ range, data: json.data ?? null, error: null });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ range, data: null, error: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  if (!loaded || (loaded.range !== range && !loaded.data)) {
    return <ListSkeleton rows={6} />;
  }
  if (loaded.error === 'not_found') {
    return <p className="text-body-medium text-md-on-surface-variant">Not found.</p>;
  }
  const data = loaded.data;
  if (!data) {
    return <p className="text-body-medium text-md-on-surface-variant">Ops metrics unavailable.</p>;
  }

  return (
    <div className={loaded.range !== range ? 'space-y-10 opacity-60 transition-opacity' : 'space-y-10'}>
      <OpsSignals signals={data.signals} />
      <OpsFunnelPanel funnel={data.funnel} />
      <OpsExplorer
        range={range}
        agents={data.agents}
        users={data.users ?? []}
        pages={data.pages}
        missing={data.missing}
        quality={data.quality}
      />
      <OpsSearchConsolePanel />
      <OpsGa4Panel range={range} />
    </div>
  );
}
