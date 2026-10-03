'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineDay } from '@/lib/analytics/stats-types';
import { niceTicks } from '@/lib/analytics/dashboard-math';
import { Button } from '@/components/ui/button';
import { formatCount, formatDay } from './format';

const SERIES = [
  { key: 'humans', label: 'People', color: 'var(--chart-people)' },
  { key: 'bots', label: 'Crawlers', color: 'var(--chart-crawlers)' },
] as const;
type SeriesKey = (typeof SERIES)[number]['key'];

const M = { top: 12, right: 88, bottom: 28, left: 44 };
const HEIGHT = 280;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Daily people visits vs crawler hits on one shared axis: legend + end
 * labels for identity, crosshair tooltip (pointer and arrow keys) for
 * values, and a table view so nothing is hover-only.
 */
export default function TrafficChart({ timeline }: { timeline: TimelineDay[] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const geo = useMemo(() => {
    const innerW = Math.max(width - M.left - M.right, 10);
    const innerH = HEIGHT - M.top - M.bottom;
    const max = Math.max(...timeline.map((d) => Math.max(d.humans, d.bots)), 0);
    const ticks = niceTicks(max, 4);
    const top = ticks[ticks.length - 1] || 1;
    const n = Math.max(timeline.length - 1, 1);
    const x = (i: number) => M.left + (timeline.length === 1 ? innerW / 2 : (i / n) * innerW);
    const y = (v: number) => M.top + innerH - (v / top) * innerH;
    const line = (k: SeriesKey) => timeline.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
    const area = `${line('humans')}L${x(timeline.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const xTickCount = Math.min(timeline.length, Math.max(2, Math.floor(innerW / 110)));
    const xTicks = Array.from(new Set(Array.from({ length: xTickCount }, (_, k) => Math.round((k / Math.max(xTickCount - 1, 1)) * (timeline.length - 1)))));
    return { innerW, innerH, ticks, x, y, line, area, xTicks };
  }, [timeline, width]);

  if (timeline.length === 0) return null;

  const last = timeline.length - 1;
  const endY = SERIES.map((s) => geo.y(timeline[last][s.key]));
  // Direct end labels only when they don't collide; the legend always carries identity.
  const endLabels = Math.abs(endY[0] - endY[1]) >= 16;
  const hover = active === null ? null : timeline[active];
  const hoverX = active === null ? 0 : geo.x(active);
  const tooltipLeft = hoverX > width / 2;

  const indexAt = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - M.left;
    const i = Math.round((px / Math.max(geo.innerW, 1)) * last);
    return Math.min(Math.max(i, 0), last);
  };

  const totals = SERIES.map((s) => timeline.reduce((sum, d) => sum + d[s.key], 0));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Legend">
          {SERIES.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2 text-label-large text-md-on-surface">
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              {s.label}
              <span className="text-md-on-surface-variant tabular-nums">{formatCount(totals[i])}</span>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="text" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? 'Hide data table' : 'Show data table'}
        </Button>
      </div>

      <div
        ref={wrapRef}
        className="relative rounded-[var(--md-shape-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
        tabIndex={0}
        role="group"
        aria-label={`Daily visits chart, ${formatDay(timeline[0].day)} to ${formatDay(timeline[last].day)}. Use arrow keys to read values.`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') (e.preventDefault(), setActive((a) => Math.min((a ?? -1) + 1, last)));
          if (e.key === 'ArrowLeft') (e.preventDefault(), setActive((a) => Math.max((a ?? last + 1) - 1, 0)));
          if (e.key === 'Home') (e.preventDefault(), setActive(0));
          if (e.key === 'End') (e.preventDefault(), setActive(last));
          if (e.key === 'Escape') setActive(null);
        }}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            className="block touch-pan-y"
            aria-hidden
            onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setActive(null)}
          >
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={M.left + geo.innerW} y1={geo.y(t)} y2={geo.y(t)} stroke="hsl(var(--md-outline-variant))" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={M.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-md-on-surface-variant text-[11px] tabular-nums">
                  {formatCount(t)}
                </text>
              </g>
            ))}
            {geo.xTicks.map((i) => (
              <text
                key={i}
                x={geo.x(i)}
                y={HEIGHT - 8}
                textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
                className="fill-md-on-surface-variant text-[11px]"
              >
                {formatDay(timeline[i].day)}
              </text>
            ))}

            <path d={geo.area} fill="var(--chart-people)" opacity={0.1} />
            {SERIES.map((s) => (
              <path key={s.key} d={geo.line(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}

            {SERIES.map((s, i) => (
              <g key={s.key}>
                <circle cx={geo.x(last)} cy={endY[i]} r={4} fill={s.color} className="stroke-md-surface dark:stroke-md-surface-container" strokeWidth={2} />
                {endLabels && (
                  <text x={geo.x(last) + 10} y={endY[i]} dy="0.32em" className="fill-md-on-surface text-[12px]">
                    {s.label}{' '}
                    <tspan className="fill-md-on-surface-variant tabular-nums">{formatCount(timeline[last][s.key])}</tspan>
                  </text>
                )}
              </g>
            ))}

            {hover && (
              <g>
                <line x1={hoverX} x2={hoverX} y1={M.top} y2={M.top + geo.innerH} stroke="hsl(var(--md-on-surface-variant))" strokeWidth={1} shapeRendering="crispEdges" />
                {SERIES.map((s) => (
                  <circle key={s.key} cx={hoverX} cy={geo.y(hover[s.key])} r={4} fill={s.color} className="stroke-md-surface dark:stroke-md-surface-container" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>
        )}

        {hover && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-[var(--md-shape-sm)] bg-md-surface-container-highest px-3 py-2 shadow-elevation-2"
            style={tooltipLeft ? { right: width - hoverX + 12 } : { left: hoverX + 12 }}
          >
            <p className="text-label-medium text-md-on-surface-variant">{formatDay(hover.day, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
            <ul className="mt-1 space-y-0.5">
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
                  <span className="text-title-medium tabular-nums text-md-on-surface">{formatCount(hover[s.key])}</span>
                  <span className="text-label-medium text-md-on-surface-variant">{s.label.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showTable && (
        <div className="mt-4 max-h-72 overflow-auto rounded-[var(--md-shape-md)] border border-md-outline-variant">
          <table className="w-full text-body-medium">
            <caption className="sr-only">Daily visits</caption>
            <thead className="sticky top-0 bg-md-surface-container text-left text-label-large text-md-on-surface-variant">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Day (UTC)</th>
                {SERIES.map((s) => (
                  <th key={s.key} scope="col" className="px-3 py-2 text-right font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...timeline].reverse().map((d) => (
                <tr key={d.day} className="border-t border-md-outline-variant">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-md-on-surface">{formatDay(d.day, { year: 'numeric', month: 'short', day: 'numeric' })}</th>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right tabular-nums text-md-on-surface">{formatCount(d[s.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
