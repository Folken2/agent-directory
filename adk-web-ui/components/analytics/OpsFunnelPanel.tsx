'use client';

import { FUNNEL_STEPS, funnelRate, type FunnelRow, type GoalFunnel } from '@/lib/analytics/funnel';

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

function StepCell({ count, of }: { count: number; of: number }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {formatCount(count)}
      {of > 0 && count > 0 ? (
        <span className="ml-1 text-label-small text-md-on-surface-variant">{pct(funnelRate(count, of))}</span>
      ) : null}
    </td>
  );
}

function LandingRow({ row, strong }: { row: FunnelRow; strong?: boolean }) {
  return (
    <tr className={strong ? 'font-medium border-b border-md-outline/40' : 'border-b border-md-outline/20'}>
      <td className="px-3 py-2 font-mono text-xs truncate max-w-[16rem]" title={row.landing}>
        {row.landing}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{formatCount(row.visits)}</td>
      {FUNNEL_STEPS.map((s) => (
        <StepCell key={s.id} count={row[s.id]} of={row.visits} />
      ))}
    </tr>
  );
}

/** Landing page → chat → builder → emailed → contact, credited to the landing page. */
export default function OpsFunnelPanel({ funnel }: { funnel: GoalFunnel }) {
  return (
    <section className="rounded-2xl border border-md-outline/40 bg-md-surface px-5 py-6 sm:px-7 space-y-6">
      <div>
        <h2 className="text-title-medium text-md-on-surface">Goal funnel</h2>
        <p className="text-body-small text-md-on-surface-variant mt-1">
          Visits by landing page, then how many of them reached each goal. Each visit counts once per step;
          percentages are of that landing page&apos;s visits. Steps are first-party clicks (no GA4 needed),
          from the last 90 days of raw data at most.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-label-small text-md-on-surface-variant">
              <th className="px-3 py-2 font-normal">Landing page</th>
              <th className="px-3 py-2 font-normal text-right">Visits</th>
              {FUNNEL_STEPS.map((s) => (
                <th key={s.id} className="px-3 py-2 font-normal text-right">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <LandingRow row={funnel.totals} strong />
            {funnel.byLanding.map((row) => (
              <LandingRow key={row.landing} row={row} />
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-label-medium text-md-on-surface mb-2">Guides</h3>
        {funnel.guides.length === 0 ? (
          <p className="text-body-small text-md-on-surface-variant">No guide traffic in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-label-small text-md-on-surface-variant">
                  <th className="px-3 py-2 font-normal">Guide</th>
                  <th className="px-3 py-2 font-normal text-right">Views</th>
                  <th className="px-3 py-2 font-normal text-right">Try agent</th>
                  <th className="px-3 py-2 font-normal text-right">Builder start</th>
                  <th className="px-3 py-2 font-normal text-right">Contact click</th>
                </tr>
              </thead>
              <tbody>
                {funnel.guides.map((g) => (
                  <tr key={g.path} className="border-b border-md-outline/20">
                    <td className="px-3 py-2 font-mono text-xs">{g.path}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(g.views)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(g.tryAgent)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(g.builderStart)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCount(g.contactClick)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-label-small text-md-on-surface-variant">
              Visits that landed on the guide or clicked on it; each visit counts once.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
