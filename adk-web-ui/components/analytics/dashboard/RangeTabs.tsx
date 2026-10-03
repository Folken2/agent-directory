'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { TIMELINE_RANGE_LABELS, TIMELINE_RANGES, type TimelineRange } from '@/lib/analytics/timeline-range';

const SHORT: Record<TimelineRange, string> = { '7': '7D', '30': '30D', '90': '90D', all: 'All' };

/** Date-range presets as a radio group (arrow keys move the selection). */
export default function RangeTabs({ value, onChange }: { value: TimelineRange; onChange: (r: TimelineRange) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (delta: number) => {
    const i = (TIMELINE_RANGES.indexOf(value) + delta + TIMELINE_RANGES.length) % TIMELINE_RANGES.length;
    onChange(TIMELINE_RANGES[i]);
    refs.current[i]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Date range"
      className="inline-flex rounded-full border border-md-outline-variant bg-md-surface p-1"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') (e.preventDefault(), move(1));
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') (e.preventDefault(), move(-1));
      }}
    >
      {TIMELINE_RANGES.map((r, i) => {
        const checked = r === value;
        return (
          <button
            key={r}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={TIMELINE_RANGE_LABELS[r]}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(r)}
            className={cn(
              'h-8 min-w-12 rounded-full px-3 text-label-large transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
              checked
                ? 'bg-md-secondary-container text-md-on-secondary-container'
                : 'text-md-on-surface-variant hover:bg-md-on-surface/8',
            )}
          >
            {SHORT[r]}
          </button>
        );
      })}
    </div>
  );
}
