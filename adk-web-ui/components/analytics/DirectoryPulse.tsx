'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PageviewStats } from '@/lib/analytics/stats';

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/** Tiny homepage badge — hidden until Neon has real visits. */
export default function DirectoryPulse() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analytics/stats')
      .then((r) => r.json())
      .then((data: { stats?: PageviewStats }) => {
        if (cancelled) return;
        const n = data?.stats?.total ?? 0;
        setTotal(n > 0 ? n : 0);
      })
      .catch(() => {
        if (!cancelled) setTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide while loading and when there is nothing real to show.
  if (total === null || total <= 0) return null;

  return (
    <Link
      href="/analytics"
      className="inline-flex items-center gap-1.5 rounded-full border border-md-outline/70 bg-md-surface-container-low/80 px-2.5 py-1 text-[11px] font-medium tracking-wide text-md-on-surface-variant hover:border-md-outline hover:text-md-on-surface transition-colors"
      title="Directory visit analytics"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-md-secondary" aria-hidden />
      <span>{formatCount(total)} visits</span>
    </Link>
  );
}
