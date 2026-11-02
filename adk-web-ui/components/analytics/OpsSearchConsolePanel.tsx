'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { GscReport, GscRow } from '@/lib/analytics/search-console';

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function pagePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || '/';
  } catch {
    return url;
  }
}

function RowsTable({ title, rows, label }: { title: string; rows: GscRow[]; label: (key: string) => string }) {
  return (
    <div className="min-w-0">
      <h3 className="text-label-medium text-md-on-surface mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-body-small text-md-on-surface-variant">No data in this window.</p>
      ) : (
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-label-small text-md-on-surface-variant">
                <th className="px-2 py-1.5 font-normal">{title === 'Queries' ? 'Query' : 'Page'}</th>
                <th className="px-2 py-1.5 font-normal text-right">Clicks</th>
                <th className="px-2 py-1.5 font-normal text-right">Impr.</th>
                <th className="px-2 py-1.5 font-normal text-right">CTR</th>
                <th className="px-2 py-1.5 font-normal text-right">Pos.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-md-outline/20">
                  <td className="px-2 py-1.5 truncate max-w-[18rem]" title={r.key}>
                    {label(r.key)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(r.clicks)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(r.impressions)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{(r.ctr * 100).toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Google Search Console: clicks, impressions, CTR and position, last 28 or 90 days. */
export default function OpsSearchConsolePanel() {
  const [reports, setReports] = useState<GscReport[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [days, setDays] = useState<28 | 90>(28);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analytics/ops/search-console', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled) setReports(json?.reports ?? null);
      })
      .catch(() => {
        if (!cancelled) setReports(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const report = reports?.find((r) => r.days === days) ?? reports?.[0] ?? null;

  return (
    <section className="rounded-2xl border border-md-outline/40 bg-md-surface px-5 py-6 sm:px-7 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-title-medium text-md-on-surface">Search Console</h2>
          <p className="text-body-small text-md-on-surface-variant mt-1">
            Google Search clicks and impressions by query and page. Refreshed every 6 hours; its own window,
            independent of the range above.
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Search Console window">
          {([28, 90] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={cn(
                'rounded-md px-2.5 py-1 text-label-small',
                days === d ? 'bg-md-surface-container text-md-on-surface' : 'text-md-on-surface-variant'
              )}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {!loaded && <p className="text-body-small text-md-on-surface-variant">Loading…</p>}

      {loaded && !report && (
        <p className="text-body-small text-md-on-surface-variant">Search Console data is unavailable.</p>
      )}

      {report && !report.configured && (
        <p className="text-body-small text-md-on-surface-variant">{report.setupHint}</p>
      )}

      {report?.configured && report.error && (
        <p className="text-body-small text-md-error">{report.error}</p>
      )}

      {report?.configured && !report.error && report.totals && (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(
              [
                ['Clicks', formatCount(report.totals.clicks)],
                ['Impressions', formatCount(report.totals.impressions)],
                ['CTR', `${(report.totals.ctr * 100).toFixed(1)}%`],
                ['Avg. position', report.totals.position.toFixed(1)],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-label-small text-md-on-surface-variant mb-1">{label}</dt>
                <dd className="text-title-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid lg:grid-cols-2 gap-6">
            <RowsTable title="Queries" rows={report.queries} label={(k) => k} />
            <RowsTable title="Pages" rows={report.pages} label={pagePath} />
          </div>
          <p className="text-label-small text-md-on-surface-variant/70">
            {report.site} · {report.startDate} to {report.endDate} · top 50 rows each
          </p>
        </>
      )}
    </section>
  );
}
