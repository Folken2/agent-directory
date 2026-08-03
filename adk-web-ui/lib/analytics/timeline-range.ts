/** Supported visit-timeline windows for `/analytics`. */
export type TimelineRange = '30' | '90' | 'all';

export const TIMELINE_RANGES: readonly TimelineRange[] = ['30', '90', 'all'] as const;

export const TIMELINE_RANGE_LABELS: Record<TimelineRange, string> = {
  '30': '30 days',
  '90': '90 days',
  all: 'All time',
};

export function parseTimelineRange(raw: string | null | undefined): TimelineRange {
  if (raw === '90' || raw === 'all') return raw;
  return '30';
}

/** Day count for fixed windows; `null` means all-time (unbounded). */
export function timelineRangeDays(range: TimelineRange): number | null {
  if (range === 'all') return null;
  return range === '90' ? 90 : 30;
}
