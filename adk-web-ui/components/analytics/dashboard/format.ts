const INT = new Intl.NumberFormat('en-US');
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const formatCount = (n: number) => INT.format(n);
/** 1,284 / 12.9K / 4.2M for headline values. */
export const formatCompact = (n: number) => (n < 10_000 ? INT.format(n) : COMPACT.format(n));

export function formatShare(share: number): string {
  if (share > 0 && share < 0.1) return '<0.1%';
  return `${share % 1 === 0 ? share.toFixed(0) : share.toFixed(1)}%`;
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}
