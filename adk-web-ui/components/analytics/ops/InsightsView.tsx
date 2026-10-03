'use client';

import type { ReactNode } from 'react';
import { Info, Lightbulb, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCatalogAgent } from '@/lib/agent-catalog-client';
import { formatDuration } from '@/lib/analytics/dashboard-math';
import type { AgentHealthRow, ToolUsageRow } from '@/lib/analytics/conversation-insights';
import type { OpsInsights } from '@/lib/analytics/ops-types';
import { panelClass } from '@/components/ui/card';
import RankedBars from '@/components/analytics/dashboard/RankedBars';
import { formatCompact, formatCount, formatShare } from '@/components/analytics/dashboard/format';
import OpsTable, { type OpsTableColumn } from '@/components/analytics/OpsTable';

const BAR = 'var(--chart-people)';

export function agentName(slug: string): string {
  const agent = getCatalogAgent(slug);
  return agent?.displayName || agent?.name || slug;
}

export function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn(panelClass, 'p-5 sm:p-6', className)}>
      <h2 className="text-title-medium text-md-on-surface">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-body-small text-md-on-surface-variant">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className={cn(panelClass, 'flex min-w-0 flex-col gap-1 p-4 sm:p-5')}>
      <p className="text-label-large text-md-on-surface-variant">{label}</p>
      <p className="text-headline-medium tabular-nums tracking-tight text-md-on-surface">{value}</p>
      {detail ? <p className="text-body-small text-md-on-surface-variant">{detail}</p> : null}
    </div>
  );
}

const TONE = {
  risk: { Icon: TrendingDown, className: 'bg-md-error-container text-md-on-error-container', label: 'Needs attention' },
  opportunity: { Icon: Lightbulb, className: 'bg-md-primary-container text-md-on-primary-container', label: 'Opportunity' },
  info: { Icon: Info, className: 'bg-md-surface-container-high text-md-on-surface-variant', label: 'Note' },
} as const;

function Highlights({ items }: { items: OpsInsights['highlights'] }) {
  if (items.length === 0) return null;
  return (
    <Panel title="Highlights" subtitle="What stands out in this range. Each one is a threshold over the numbers below.">
      <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {items.map((h) => {
          const tone = TONE[h.tone];
          return (
            <li key={h.id} className="flex gap-3">
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', tone.className)}>
                <tone.Icon className="size-4" aria-hidden />
                <span className="sr-only">{tone.label}:</span>
              </span>
              <span>
                <span className="block text-title-small text-md-on-surface">{h.title}</span>
                <span className="mt-0.5 block text-body-medium text-md-on-surface-variant">{h.detail}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Funnel({ steps }: { steps: OpsInsights['funnel'] }) {
  if (steps[0]?.count === 0) {
    return <p className="text-body-medium text-md-on-surface-variant">No builder conversations in this range.</p>;
  }
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={step.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-4">
            <span className="text-body-medium text-md-on-surface">{step.label}</span>
            <span className="shrink-0 text-right text-body-medium tabular-nums text-md-on-surface">
              {formatCount(step.count)}
              <span className="ml-2 inline-block w-12 text-label-medium text-md-on-surface-variant">{formatShare(step.ofFirst)}</span>
            </span>
          </div>
          <div className="h-2 rounded-r-[4px]" style={{ width: `${Math.max(step.ofFirst, 1)}%`, backgroundColor: BAR }} aria-hidden />
          {i > 0 ? (
            <p className="mt-1 text-label-medium text-md-on-surface-variant">
              {formatShare(step.ofPrevious)} of the step before
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function shareRows(rows: { id: string; label: string; count: number; share: number }[]) {
  return rows.map((r) => ({ id: r.id, label: r.label, count: r.count, share: r.share }));
}

const agentColumns: OpsTableColumn<AgentHealthRow>[] = [
  { key: 'agent', header: 'Agent', sortValue: (r) => agentName(r.agentSlug), render: (r) => agentName(r.agentSlug) },
  { key: 'conversations', header: 'Conversations', align: 'right', sortValue: (r) => r.conversations, render: (r) => formatCount(r.conversations) },
  { key: 'turns', header: 'Msgs / conv.', align: 'right', sortValue: (r) => r.avgTurns, render: (r) => r.avgTurns.toFixed(1) },
  { key: 'single', header: 'Single msg', align: 'right', sortValue: (r) => r.oneAndDoneRate, render: (r) => formatShare(r.oneAndDoneRate) },
  { key: 'friction', header: 'Friction', align: 'right', sortValue: (r) => r.frictionRate, render: (r) => formatShare(r.frictionRate) },
  { key: 'errors', header: 'Errors', align: 'right', sortValue: (r) => r.errorRate, render: (r) => formatShare(r.errorRate) },
  { key: 'reply', header: 'First reply', align: 'right', sortValue: (r) => r.medianFirstReplyMs, render: (r) => formatDuration(r.medianFirstReplyMs) },
  { key: 'tokens', header: 'Tokens / conv.', align: 'right', sortValue: (r) => r.avgTokens, render: (r) => formatCompact(r.avgTokens) },
];

const toolColumns: OpsTableColumn<ToolUsageRow>[] = [
  { key: 'tool', header: 'Tool', sortValue: (r) => r.tool, render: (r) => <code className="font-mono text-[13px]">{r.tool}</code> },
  { key: 'agent', header: 'Agent', sortValue: (r) => agentName(r.agentSlug), render: (r) => agentName(r.agentSlug) },
  { key: 'calls', header: 'Calls', align: 'right', sortValue: (r) => r.calls, render: (r) => formatCount(r.calls) },
  { key: 'conversations', header: 'Conversations', align: 'right', sortValue: (r) => r.conversations, render: (r) => formatCount(r.conversations) },
];

export default function InsightsView({
  data,
  onOpenConversation,
}: {
  data: OpsInsights;
  onOpenConversation: (appName: string, sessionId: string) => void;
}) {
  const o = data.overview;
  const d = data.demand;
  const b = data.blueprints;

  if (!data.available) {
    return (
      <div className={cn(panelClass, 'px-8 py-16 text-center')}>
        <p className="text-title-medium text-md-on-surface">No conversations in this range</p>
        <p className="mx-auto mt-2 max-w-md text-body-medium text-md-on-surface-variant">
          Insights read the ADK session store. They appear once agents have conversations in this database.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Highlights items={data.highlights} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        <Metric
          label="Conversations"
          value={formatCompact(o.conversations)}
          detail={`${formatCount(o.people)} people · ${formatShare(o.signedInShare)} signed in`}
        />
        <Metric label="Messages per conversation" value={o.avgTurns.toFixed(1)} detail={`${formatCompact(o.messages)} messages`} />
        <Metric label="Single message" value={formatShare(o.oneAndDoneRate)} detail="Left after one reply" />
        <Metric label="Friction" value={formatShare(o.frictionRate)} detail="Complained or repeated themselves" />
        <Metric label="Errors" value={formatShare(o.errorRate)} detail="Conversations with an error" />
        <Metric
          label="First reply"
          value={formatDuration(o.medianFirstReplyMs)}
          detail={`Median · p90 ${formatDuration(o.p90FirstReplyMs)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Builder funnel" subtitle="Builder conversations, from first message to a saved blueprint">
          <Funnel steps={data.funnel} />
        </Panel>
        <Panel
          title="What people ask for"
          subtitle={`Topics in ${formatCount(d.organicConversations)} typed first messages · ${formatCount(d.suggestionConversations)} more started from a suggestion`}
        >
          <RankedBars rows={shareRows(d.domains).slice(0, 8)} color={BAR} empty="No typed first messages in this range." />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Integrations mentioned" subtitle="Share of typed conversations naming the product">
          <RankedBars rows={shareRows(d.integrations).slice(0, 8)} color={BAR} empty="No integrations mentioned." />
        </Panel>
        <Panel
          title="What they design"
          subtitle={`${formatCount(b.total)} blueprints · ${b.avgAgents} agents on average · ${formatCount(b.withDataSources)} with data sources`}
        >
          <RankedBars rows={shareRows(b.architectures)} color={BAR} empty="No blueprints in this range." />
        </Panel>
        <Panel title="Tools in blueprints" subtitle="Share of blueprints using each kind of tool">
          <RankedBars rows={shareRows(b.toolKinds)} color={BAR} empty="No tools in blueprints." />
        </Panel>
      </div>

      <Panel title="Latest blueprints" subtitle={`${formatCount(b.saved)} of ${formatCount(b.total)} saved with an email`}>
        {b.recent.length === 0 ? (
          <p className="text-body-medium text-md-on-surface-variant">No blueprints in this range.</p>
        ) : (
          <ul className="divide-y divide-md-outline/60 dark:divide-md-outline-variant">
            {b.recent.map((bp) => (
              <li key={bp.sessionId}>
                <button
                  type="button"
                  onClick={() => onOpenConversation('adk_agent_builder', bp.sessionId)}
                  className="-mx-2 flex w-[calc(100%+1rem)] flex-col gap-1 rounded-[var(--md-shape-sm)] px-2 py-3 text-left transition-colors hover:bg-md-on-surface/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary sm:flex-row sm:items-start sm:gap-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-title-small text-md-on-surface">{bp.name}</span>
                      {bp.saved ? (
                        <span className="shrink-0 rounded-full bg-md-primary-container px-2 py-0.5 text-label-medium text-md-on-primary-container">
                          Saved
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-body-medium text-md-on-surface-variant">{bp.goal}</span>
                  </span>
                  <span className="shrink-0 text-label-medium text-md-on-surface-variant sm:w-64 sm:text-right">
                    {bp.architecture} · {bp.agents} {bp.agents === 1 ? 'agent' : 'agents'}
                    {bp.tools.length > 0 ? <span className="block truncate">{bp.tools.join(', ')}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Top blueprint tools" subtitle="Tool names the builder proposed">
          <RankedBars rows={shareRows(b.tools).slice(0, 8)} color={BAR} empty="No tools in blueprints." />
        </Panel>
        <Panel title="Languages" subtitle="Of typed first messages">
          <RankedBars rows={shareRows(d.languages)} color={BAR} empty="No typed first messages." />
        </Panel>
        <Panel title="Models in blueprints" subtitle="Share of blueprints naming each model">
          <RankedBars rows={shareRows(b.models)} color={BAR} empty="No models named." />
        </Panel>
      </div>

      <Panel title="Agent health" subtitle="Per agent, for conversations in this range">
        <OpsTable rows={data.agents} columns={agentColumns} rowKey={(r) => r.agentSlug} />
      </Panel>

      <Panel title="Tool calls" subtitle="What the agents actually called while answering">
        <OpsTable rows={data.tools} columns={toolColumns} rowKey={(r) => `${r.agentSlug}:${r.tool}`} />
      </Panel>
    </div>
  );
}
