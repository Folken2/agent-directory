'use client';

import { useEffect, useState } from 'react';
import type { PageviewStats } from '@/lib/analytics/stats';
import VisitsTimeline from '@/components/analytics/VisitsTimeline';

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function formatActiveLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function RankRow({
  label,
  meta,
  count,
  max,
}: {
  label: string;
  meta?: string;
  count: number;
  max: number;
}) {
  const width = Math.max((count / max) * 100, 2);

  return (
    <li className="group py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="text-title-medium text-md-on-surface truncate">{label}</span>
          {meta ? (
            <span className="text-label-small text-md-on-surface-variant/50 shrink-0">
              {meta}
            </span>
          ) : null}
        </div>
        <span className="text-label-large text-md-on-surface-variant tabular-nums shrink-0">
          {formatCount(count)}
        </span>
      </div>
      <div className="h-px bg-md-outline overflow-hidden">
        <div
          className="h-full bg-md-primary/70 transition-[width] duration-500 ease-out group-hover:bg-md-primary"
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
  );
}

export default function AnalyticsPreview() {
  const [stats, setStats] = useState<PageviewStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/analytics/stats')
      .then((r) => r.json())
      .then((data: { stats?: PageviewStats }) => {
        if (cancelled) return;
        setStats(data?.stats ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setStats(null);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="h-40 flex items-center justify-center">
        <p className="text-body-medium text-md-on-surface-variant">Loading…</p>
      </div>
    );
  }

  if (!stats || stats.total <= 0) {
    return (
      <div className="bg-md-surface-container elevation-1 rounded-2xl px-8 py-16 text-center">
        <p className="text-title-medium text-md-on-surface mb-2">No visits yet</p>
        <p className="text-body-medium text-md-on-surface-variant max-w-sm mx-auto">
          Counts appear here once Neon is connected and the directory starts receiving traffic.
        </p>
      </div>
    );
  }

  const maxCountry = stats.byCountry[0]?.count || 1;
  const maxBot = stats.byBot[0]?.count || 1;
  const topAgents = stats.topAgents ?? [];
  const maxAgent = topAgents[0]?.messages || topAgents[0]?.activeMs || 1;
  const humanPct = Math.round((stats.humans / stats.total) * 100);

  return (
    <div className="space-y-10">
      <div className="bg-md-surface-container elevation-1 rounded-2xl px-8 py-10 text-center">
        <p className="text-label-small uppercase tracking-widest text-md-on-surface-variant/60 mb-3">
          Total visits
        </p>
        <p className="text-display-medium sm:text-display-large font-bold text-md-on-surface tracking-tight tabular-nums">
          {formatCompact(stats.total)}
        </p>
        <p className="mt-4 text-body-medium text-md-on-surface-variant">
          {humanPct}% human · {formatCompact(stats.bots)} bots
        </p>
      </div>

      {stats.timeline?.length ? <VisitsTimeline timeline={stats.timeline} /> : null}

      <section className="bg-md-surface elevation-1 rounded-xl p-6 sm:p-8">
        <h2 className="text-title-medium text-md-on-surface mb-1">Agents people use</h2>
        <p className="text-body-small text-md-on-surface-variant mb-6">
          Active use after analytics consent — messages and time in chat
        </p>
        {topAgents.length === 0 ? (
          <p className="text-body-small text-md-on-surface-variant">
            No consented engagement yet. Visit counts above still include everyone.
          </p>
        ) : (
          <ul>
            {topAgents.map((a) => (
              <RankRow
                key={a.agentSlug}
                label={a.agentSlug}
                meta={`${formatCount(a.messages)} msgs · ${formatActiveLabel(a.activeMs)}`}
                count={a.messages > 0 ? a.messages : a.activeMs}
                max={maxAgent}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-md-surface elevation-1 rounded-xl p-6 sm:p-8">
          <h2 className="text-title-medium text-md-on-surface mb-1">Countries</h2>
          <p className="text-body-small text-md-on-surface-variant mb-6">
            Top origins this period
          </p>
          {stats.byCountry.length === 0 ? (
            <p className="text-body-small text-md-on-surface-variant">No geo data yet.</p>
          ) : (
            <ul>
              {stats.byCountry.map((c) => (
                <RankRow
                  key={c.country}
                  label={c.country}
                  count={c.count}
                  max={maxCountry}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="bg-md-surface elevation-1 rounded-xl p-6 sm:p-8">
          <h2 className="text-title-medium text-md-on-surface mb-1">Crawlers</h2>
          <p className="text-body-small text-md-on-surface-variant mb-6">
            Identified bots & agents
          </p>
          {stats.byBot.length === 0 ? (
            <p className="text-body-small text-md-on-surface-variant">No crawlers recorded yet.</p>
          ) : (
            <ul>
              {stats.byBot.map((b) => (
                <RankRow
                  key={b.botName}
                  label={b.botName}
                  meta={b.category}
                  count={b.count}
                  max={maxBot}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
