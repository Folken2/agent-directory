'use client';

import { useId, useMemo, useState } from 'react';
import type { TimelineDay } from '@/lib/analytics/stats';

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
};

/**
 * Minimal area chart for daily visits — no chart library.
 */
export default function VisitsTimeline({ timeline }: Props) {
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

  return (
    <section className="bg-md-surface elevation-1 rounded-xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-title-medium text-md-on-surface mb-1">Timeline</h2>
          <p className="text-body-small text-md-on-surface-variant">
            Last {timeline.length} days · UTC
          </p>
        </div>
        <p className="text-label-large text-md-on-surface-variant tabular-nums">
          {formatCount(periodTotal)} in period
        </p>
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
          aria-label="Daily visits over the last month"
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--md-primary))" stopOpacity="0.22" />
              <stop offset="100%" stopColor="hsl(var(--md-primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Baseline */}
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
          <span className="tabular-nums">peak {formatCount(max)}</span>
          <span>{last ? formatDayLabel(last) : ''}</span>
        </div>
      </div>
    </section>
  );
}
