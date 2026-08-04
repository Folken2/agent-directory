'use client';

import { useEffect, useState } from 'react';
import type { TimelineRange } from '@/lib/analytics/timeline-range';

type Ga4Row = { value: string; sessions: number };

type Ga4Report = {
  configured: boolean;
  setupHint?: string;
  propertyStartedAt: string;
  channelGroup: Ga4Row[];
  deviceCategory: Ga4Row[];
  newVsReturning: Ga4Row[];
  disclaimer: string;
};

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function DimTable({ title, rows }: { title: string; rows: Ga4Row[] }) {
  return (
    <div>
      <h3 className="text-label-medium text-md-on-surface mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-body-small text-md-on-surface-variant">No data yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.value} className="flex justify-between gap-4">
              <span className="text-md-on-surface truncate">{r.value}</span>
              <span className="text-md-on-surface-variant tabular-nums shrink-0">
                {formatCount(r.sessions)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OpsGa4Panel({ range }: { range: TimelineRange }) {
  const [report, setReport] = useState<Ga4Report | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      try {
        const res = await fetch(`/api/analytics/ops/ga4?range=${range}`, {
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setReport(json.report ?? null);
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <section className="rounded-2xl border border-md-outline/40 bg-md-surface px-5 py-6 sm:px-7 space-y-4">
      <div>
        <h2 className="text-title-medium text-md-on-surface">GA4 acquisition</h2>
        <p className="text-body-small text-md-on-surface-variant mt-1">
          Channel group, device, and new vs returning — consent-gated sample only.
        </p>
      </div>

      {!loaded && (
        <p className="text-body-small text-md-on-surface-variant">Loading…</p>
      )}

      {loaded && report && !report.configured && (
        <p className="text-body-small text-md-on-surface-variant">
          {report.setupHint ??
            'GA4 is not configured. Add GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON.'}
        </p>
      )}

      {loaded && report?.configured && (
        <>
          <div className="grid sm:grid-cols-3 gap-6">
            <DimTable title="Channel group" rows={report.channelGroup} />
            <DimTable title="Device" rows={report.deviceCategory} />
            <DimTable title="New vs returning" rows={report.newVsReturning} />
          </div>
          <p className="text-label-small text-md-on-surface-variant/70">
            {report.disclaimer}
          </p>
        </>
      )}
    </section>
  );
}
