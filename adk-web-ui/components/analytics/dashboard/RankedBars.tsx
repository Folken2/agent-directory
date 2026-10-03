import type { ReactNode } from 'react';
import { formatCount, formatShare } from './format';

export type RankedRow = { id: string; label: ReactNode; count: number; share: number; meta?: ReactNode; title?: string };

/**
 * Ranked magnitudes as thin horizontal bars in one hue (length = count),
 * value and share at the right so nothing depends on hover.
 */
export default function RankedBars({
  rows,
  color,
  empty,
}: {
  rows: RankedRow[];
  color: string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-body-medium text-md-on-surface-variant">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="group" title={r.title}>
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2 text-body-medium text-md-on-surface">{r.label}</div>
            <div className="shrink-0 text-right text-body-medium tabular-nums text-md-on-surface">
              {formatCount(r.count)}
              <span className="ml-2 inline-block w-12 text-label-medium text-md-on-surface-variant">{formatShare(r.share)}</span>
            </div>
          </div>
          {r.meta ? <div className="mb-1.5 text-label-medium text-md-on-surface-variant">{r.meta}</div> : null}
          <div
            className="h-2 rounded-r-[4px] transition-opacity group-hover:opacity-80"
            style={{ width: `${Math.max((r.count / max) * 100, 1)}%`, backgroundColor: color }}
            aria-hidden
          />
        </li>
      ))}
    </ul>
  );
}
