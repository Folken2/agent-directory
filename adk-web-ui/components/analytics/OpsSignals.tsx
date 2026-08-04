'use client';

import type { OpsSignal, SignalSeverity } from '@/lib/analytics/signals';

function severityClass(severity: SignalSeverity): string {
  if (severity === 'high') return 'border-red-500/40 bg-red-500/5';
  if (severity === 'medium') return 'border-amber-500/40 bg-amber-500/5';
  return 'border-md-outline/40 bg-md-surface';
}

function severityLabel(severity: SignalSeverity): string {
  if (severity === 'high') return 'High';
  if (severity === 'medium') return 'Medium';
  return 'Info';
}

export default function OpsSignals({ signals }: { signals: OpsSignal[] }) {
  if (signals.length === 0) {
    return (
      <section className="rounded-2xl border border-md-outline/40 bg-md-surface px-5 py-6 sm:px-7">
        <h2 className="text-title-medium text-md-on-surface mb-2">Signals</h2>
        <p className="text-body-medium text-md-on-surface-variant">
          No findings yet — Neon may be empty for this range, or every heuristic
          is quiet. Widen the timeline or wait for more traffic.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-title-medium text-md-on-surface">Signals</h2>
        <p className="text-label-small text-md-on-surface-variant">
          Heuristic findings — no LLM
        </p>
      </div>
      <ul className="space-y-3">
        {signals.map((signal) => (
          <li
            key={signal.id}
            className={`rounded-xl border px-4 py-4 sm:px-5 ${severityClass(signal.severity)}`}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
              <span className="text-label-small uppercase tracking-wide text-md-on-surface-variant">
                {severityLabel(signal.severity)}
              </span>
              <h3 className="text-title-small text-md-on-surface">{signal.title}</h3>
            </div>
            <p className="text-body-small text-md-on-surface mb-2">
              <span className="text-md-on-surface-variant">Evidence · </span>
              {signal.evidence}
            </p>
            <p className="text-body-small text-md-on-surface mb-2">
              <span className="text-md-on-surface-variant">Suggested · </span>
              {signal.suggestedAction}
            </p>
            <p className="text-label-small text-md-on-surface-variant/70">
              {signal.coverageBasis}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
