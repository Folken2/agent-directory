import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deltaPct } from '@/lib/analytics/dashboard-math';
import { formatCompact } from './format';

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mb-1.5 h-8 w-24 shrink-0" aria-hidden preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * KPI tile: label, value, change vs the previous period (arrow + sign, so
 * direction never relies on color) and an optional sparkline.
 */
export default function StatTile({
  label,
  value,
  previous,
  periodLabel,
  upIsGood = true,
  hint,
  trend,
  trendColor,
  hero = false,
  className,
}: {
  label: string;
  value: number;
  previous?: number | null;
  periodLabel?: string;
  upIsGood?: boolean | null;
  hint?: string;
  trend?: number[];
  trendColor?: string;
  hero?: boolean;
  className?: string;
}) {
  const delta = deltaPct(value, previous);
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const tone =
    delta === null || delta === 0 || upIsGood === null
      ? 'text-md-on-surface-variant'
      : (delta > 0) === upIsGood
        ? 'text-chart-good-text'
        : 'text-chart-bad-text';

  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-[var(--md-shape-lg)] bg-md-surface p-4 sm:p-5 dark:bg-md-surface-container', className)}>
      <p className="truncate text-label-large text-md-on-surface-variant">
        {label}
        {hint ? <span className="text-label-medium text-md-on-surface-variant/80"> · {hint}</span> : null}
      </p>
      <div className="flex items-end justify-between gap-3">
        <p className={cn('font-semibold tracking-tight text-md-on-surface', hero ? 'text-[44px] leading-[52px]' : 'text-[32px] leading-10')}>
          {formatCompact(value)}
        </p>
        {trend && trendColor ? <Sparkline values={trend} color={trendColor} /> : null}
      </div>
      {periodLabel ? (
        <p className={cn('flex items-center gap-1 text-label-medium', tone)}>
          <Icon className="size-4 shrink-0" aria-hidden />
          {delta === null ? (
            <span className="text-md-on-surface-variant">No prior data</span>
          ) : (
            <>
              <span className="tabular-nums">
                {delta > 0 ? '+' : ''}
                {delta}%
              </span>
              <span className="truncate text-md-on-surface-variant">
                <span className="sr-only sm:not-sr-only">vs {periodLabel}</span>
              </span>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
