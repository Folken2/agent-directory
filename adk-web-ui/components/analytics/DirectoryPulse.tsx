'use client';

import Link from 'next/link';
import { usePageviewStats } from '@/lib/analytics/use-pageview-stats';

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/** Footer link to the visits dashboard — hidden until there are real visits. */
export default function DirectoryPulse({ className }: { className?: string }) {
  // All-time human visits: a lifetime figure, not a window.
  const { stats, loaded } = usePageviewStats('all');
  const total = loaded ? (stats?.visits ?? 0) : null;

  if (total === null || total <= 0) return null;

  return (
    <Link href="/analytics" className={className}>
      {formatCount(total)} visits
    </Link>
  );
}
