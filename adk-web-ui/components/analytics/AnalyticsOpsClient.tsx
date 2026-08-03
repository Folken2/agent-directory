'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatActiveLabel,
  type BotAgentStat,
} from '@/lib/analytics/stats-types';
import { botCompany } from '@/lib/analytics/bot-companies';
import { formatAgentDisplayName } from '@/lib/agent-utils';
import type { TimelineRange } from '@/lib/analytics/timeline-range';
import VisitsTimeline from '@/components/analytics/VisitsTimeline';
import BrandMark from '@/components/analytics/BrandMark';
import { usePageviewStats } from '@/lib/analytics/use-pageview-stats';

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function BotTable({ rows }: { rows: BotAgentStat[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-md-outline/40">
      <table className="w-full text-left text-sm">
        <thead className="bg-md-surface-container/60 text-label-small text-md-on-surface-variant">
          <tr>
            <th className="px-4 py-2.5 font-medium">Company</th>
            <th className="px-4 py-2.5 font-medium">Bot</th>
            <th className="px-4 py-2.5 font-medium">Purpose</th>
            <th className="px-4 py-2.5 font-medium text-right">Hits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const company = botCompany(r.botName);
            return (
              <tr
                key={r.botName}
                className="border-t border-md-outline/30 text-md-on-surface"
              >
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <BrandMark
                      id={company.id}
                      name={company.name}
                      color={company.color}
                      domain={company.domain}
                      size={18}
                    />
                    {company.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.botName}</td>
                <td className="px-4 py-2.5 text-md-on-surface-variant">
                  {r.purposeLabel}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCount(r.count)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsOpsClient() {
  const [range, setRange] = useState<TimelineRange>('30');
  const { stats, loaded } = usePageviewStats(range);

  const byBot = useMemo(() => stats?.byBot ?? [], [stats?.byBot]);
  const topAgents = stats?.topAgents ?? [];

  if (!loaded && !stats) {
    return (
      <p className="text-body-medium text-md-on-surface-variant">Loading…</p>
    );
  }

  if (!stats) {
    return (
      <p className="text-body-medium text-md-on-surface-variant">
        Stats unavailable.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-md-outline/40 bg-md-surface px-5 py-5 sm:px-7">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-label-small text-md-on-surface-variant/60 mb-1">
              Total
            </p>
            <p className="text-headline-small tabular-nums font-semibold">
              {formatCount(stats.total)}
            </p>
          </div>
          <div>
            <p className="text-label-small text-md-on-surface-variant/60 mb-1">
              Humans
            </p>
            <p className="text-headline-small tabular-nums font-semibold">
              {formatCount(stats.humans)}
            </p>
          </div>
          <div>
            <p className="text-label-small text-md-on-surface-variant/60 mb-1">
              Bots
            </p>
            <p className="text-headline-small tabular-nums font-semibold">
              {formatCount(stats.bots)}
            </p>
          </div>
          <div>
            <p className="text-label-small text-md-on-surface-variant/60 mb-1">
              Agents (engaged)
            </p>
            <p className="text-headline-small tabular-nums font-semibold">
              {formatCount(topAgents.length)}
            </p>
          </div>
        </div>
      </section>

      {stats.timeline?.length ? (
        <VisitsTimeline
          timeline={stats.timeline}
          range={range}
          onRangeChange={setRange}
        />
      ) : null}

      <section>
        <h2 className="text-title-medium text-md-on-surface mb-1">
          Engagement by agent
        </h2>
        <p className="text-body-small text-md-on-surface-variant mb-4">
          All-time consented messages and active time
        </p>
        {topAgents.length === 0 ? (
          <p className="text-body-small text-md-on-surface-variant">None yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-md-outline/40">
            <table className="w-full text-left text-sm">
              <thead className="bg-md-surface-container/60 text-label-small text-md-on-surface-variant">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Agent</th>
                  <th className="px-4 py-2.5 font-medium">Slug</th>
                  <th className="px-4 py-2.5 font-medium text-right">Messages</th>
                  <th className="px-4 py-2.5 font-medium text-right">Active</th>
                </tr>
              </thead>
              <tbody>
                {topAgents.map((a) => (
                  <tr
                    key={a.agentSlug}
                    className="border-t border-md-outline/30"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/agents/${encodeURIComponent(a.agentSlug)}`}
                        className="text-md-primary hover:underline"
                      >
                        {formatAgentDisplayName(a.agentSlug)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-md-on-surface-variant">
                      {a.agentSlug}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatCount(a.messages)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatActiveLabel(a.activeMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-title-medium text-md-on-surface mb-1">
          Crawlers (raw)
        </h2>
        <p className="text-body-small text-md-on-surface-variant mb-4">
          Individual bot user-agents rolled up by company
        </p>
        {byBot.length === 0 ? (
          <p className="text-body-small text-md-on-surface-variant">None yet.</p>
        ) : (
          <BotTable rows={byBot} />
        )}
      </section>
    </div>
  );
}
