'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAgo } from '@/lib/analytics/dashboard-math';
import { OUTCOME_LABELS, type ConversationOutcome } from '@/lib/analytics/conversation-insights';
import type { ConversationListItem } from '@/lib/analytics/ops-types';
import { panelClass } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { formatCompact } from '@/components/analytics/dashboard/format';
import { agentName } from './InsightsView';

type Filter = 'all' | ConversationOutcome | 'friction';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'emailed', label: OUTCOME_LABELS.emailed },
  { id: 'zip', label: OUTCOME_LABELS.zip },
  { id: 'friction', label: 'Friction' },
  { id: 'error', label: OUTCOME_LABELS.error },
  { id: 'one-and-done', label: OUTCOME_LABELS['one-and-done'] },
  { id: 'engaged', label: OUTCOME_LABELS.engaged },
];

function OutcomeBadge({ outcome }: { outcome: ConversationOutcome }) {
  const tone =
    outcome === 'emailed' || outcome === 'zip'
      ? 'bg-md-primary-container text-md-on-primary-container'
      : outcome === 'error'
        ? 'bg-md-error-container text-md-on-error-container'
        : 'bg-md-surface-container-high text-md-on-surface-variant';
  return <span className={cn('rounded-full px-2 py-0.5 text-label-medium', tone)}>{OUTCOME_LABELS[outcome]}</span>;
}

export default function ConversationsView({
  rows,
  onOpen,
}: {
  rows: ConversationListItem[];
  onOpen: (appName: string, sessionId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [agent, setAgent] = useState<string>('all');
  const [query, setQuery] = useState('');

  const agents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.appName, (counts.get(r.appName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([slug]) => slug);
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (agent !== 'all' && r.appName !== agent) return false;
      if (filter === 'friction' && r.friction.length === 0) return false;
      if (filter !== 'all' && filter !== 'friction' && r.outcome !== filter) return false;
      return !q || r.firstPrompt.toLowerCase().includes(q) || r.user.toLowerCase().includes(q);
    });
  }, [rows, filter, agent, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-md-on-surface-variant" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search first messages or people"
            aria-label="Search conversations"
            className="pl-11"
          />
        </div>
        <label className="flex items-center gap-2 text-label-large text-md-on-surface-variant">
          Agent
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="h-10 rounded-full border border-md-outline/70 bg-md-surface px-3 text-body-medium text-md-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary dark:bg-md-surface-container"
          >
            <option value="all">All agents</option>
            {agents.map((slug) => (
              <option key={slug} value={slug}>
                {agentName(slug)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div role="group" aria-label="Filter by outcome" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.id} variant="filter" selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <p className="text-label-medium text-md-on-surface-variant" role="status">
        {visible.length} of {rows.length} most recent conversations
      </p>

      {visible.length === 0 ? (
        <div className={cn(panelClass, 'px-6 py-12 text-center text-body-medium text-md-on-surface-variant')}>
          No conversations match.
        </div>
      ) : (
        <ul className={cn(panelClass, 'divide-y divide-md-outline/60 overflow-hidden dark:divide-md-outline-variant')}>
          {visible.map((r) => (
            <li key={`${r.appName}/${r.sessionId}`}>
              <button
                type="button"
                onClick={() => onOpen(r.appName, r.sessionId)}
                className="flex w-full flex-col gap-1.5 px-5 py-4 text-left transition-colors hover:bg-md-on-surface/4 focus-visible:bg-md-on-surface/8 focus-visible:outline-none"
              >
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label-medium text-md-on-surface-variant">
                  <span className="text-title-small text-md-on-surface">{agentName(r.appName)}</span>
                  <span>{r.user}</span>
                  <span>{formatAgo(r.lastAt)}</span>
                  <span className="ml-auto flex flex-wrap items-center gap-1.5">
                    <OutcomeBadge outcome={r.outcome} />
                    {r.friction.map((f) => (
                      <span key={f} className="rounded-full border border-md-outline/70 px-2 py-0.5 text-label-medium text-md-on-surface-variant">
                        {f}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="line-clamp-2 text-body-medium text-md-on-surface">{r.firstPrompt || '(no text)'}</span>
                <span className="text-label-medium text-md-on-surface-variant">
                  {r.userTurns} {r.userTurns === 1 ? 'message' : 'messages'}
                  {r.toolCalls > 0 ? ` · ${r.toolCalls} tool ${r.toolCalls === 1 ? 'call' : 'calls'}` : ''}
                  {r.tokens > 0 ? ` · ${formatCompact(r.tokens)} tokens` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
