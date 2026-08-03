'use client';

import { useId, useMemo, useState } from 'react';
import type { TimelineDay } from '@/lib/analytics/stats-types';
import {
  TIMELINE_RANGE_LABELS,
  TIMELINE_RANGES,
  type TimelineRange,
} from '@/lib/analytics/timeline-range';

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatDayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

type Props = {
  timeline: TimelineDay[];
  range: TimelineRange;
  onRangeChange: (range: TimelineRange) => void;
};

/**
 * Minimal area chart for daily visits — no chart library.
 */
export default function VisitsTimeline({
  timeline,
  range,
  onRangeChange,
}: Props) {
  const gradId = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);

  const { path, area, max, points } = useMemo(() => {
    const width = 1000;
    const height = 280;
    const padX = 8;
    const padY = 24;
    const maxVal = Math.max(1, ...timeline.map((t) => t.total));
    const n = Math.max(timeline.length - 1, 1);

    const pts = timeline.map((t, i) => {
      const x = padX + (i / n) * (width - padX * 2);
      const y = padY + (1 - t.total / maxVal) * (height - padY * 2);
      return { x, y, ...t };
    });

    const line = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');

    const areaPath =
      pts.length === 0
        ? ''
        : `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${(height - padY).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(height - padY).toFixed(1)} Z`;

    return { path: line, area: areaPath, max: maxVal, points: pts };
  }, [timeline]);

  if (timeline.length === 0) return null;

  const hover = active !== null ? points[active] : null;
  const first = timeline[0]?.day;
  const last = timeline[timeline.length - 1]?.day;
  const periodTotal = timeline.reduce((sum, t) => sum + t.total, 0);
  const rangeLabel =
    range === 'all'
      ? 'All time'
      : `Last ${timeline.length} days`;

  return (
    <section className="rounded-2xl border border-md-outline/40 bg-md-surface px-5 py-6 sm:px-7 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-title-medium text-md-on-surface mb-1">Timeline</h2>
          <p className="text-body-small text-md-on-surface-variant">
            {rangeLabel} · UTC
            {max > 0 ? (
              <span className="text-md-on-surface-variant/70">
                {' '}
                · peak {formatCount(max)}/day
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-3">
          <div
            className="inline-flex rounded-lg border border-md-outline/50 bg-md-surface-container/50 p-0.5"
            role="group"
            aria-label="Timeline range"
          >
            {TIMELINE_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRangeChange(r)}
                className={
                  r === range
                    ? 'px-2.5 py-1 rounded-md text-label-small font-medium bg-md-surface text-md-on-surface shadow-sm'
                    : 'px-2.5 py-1 rounded-md text-label-small text-md-on-surface-variant hover:text-md-on-surface'
                }
              >
                {TIMELINE_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <p className="text-label-large text-md-on-surface-variant tabular-nums">
            {formatCount(periodTotal)} in period
          </p>
        </div>
      </div>

      <div className="relative">
        {hover ? (
          <div className="absolute top-0 right-0 z-10 text-right pointer-events-none">
            <p className="text-label-small uppercase tracking-widest text-md-on-surface-variant/60">
              {formatDayLabel(hover.day)}
            </p>
            <p className="text-headline-small font-semibold text-md-on-surface tabular-nums">
              {formatCount(hover.total)}
            </p>
            <p className="text-label-small text-md-on-surface-variant tabular-nums">
              {formatCount(hover.humans)} human · {formatCount(hover.bots)} bot
            </p>
          </div>
        ) : null}

        <svg
          viewBox="0 0 1000 280"
          className="w-full h-[200px] sm:h-[240px] overflow-visible"
          role="img"
          aria-label={`Daily visits — ${TIMELINE_RANGE_LABELS[range]}`}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--md-primary))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="hsl(var(--md-primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1="8"
            x2="992"
            y1="256"
            y2="256"
            stroke="hsl(var(--md-outline))"
            strokeWidth="1"
          />

          <path d={area} fill={`url(#fill-${gradId})`} />
          <path
            d={path}
            fill="none"
            stroke="hsl(var(--md-primary))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => (
            <g key={p.day}>
              {active === i ? (
                <>
                  <line
                    x1={p.x}
                    x2={p.x}
                    y1="24"
                    y2="256"
                    stroke="hsl(var(--md-outline))"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="hsl(var(--md-surface))"
                    stroke="hsl(var(--md-primary))"
                    strokeWidth="2.5"
                  />
                </>
              ) : null}
              <rect
                x={p.x - 1000 / points.length / 2}
                y="0"
                width={1000 / points.length}
                height="280"
                fill="transparent"
                onMouseEnter={() => setActive(i)}
              />
            </g>
          ))}
        </svg>

        <div className="flex justify-between mt-3 text-label-small text-md-on-surface-variant/60">
          <span>{first ? formatDayLabel(first) : ''}</span>
          <span>{last ? formatDayLabel(last) : ''}</span>
        </div>
      </div>
    </section>
  );
}
