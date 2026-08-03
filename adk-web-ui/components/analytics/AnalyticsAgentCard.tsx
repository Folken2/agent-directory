'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  formatActiveLabel,
  type AgentEngagementStat,
} from '@/lib/analytics/stats-types';
import type { Agent } from '@/lib/types';

type Props = {
  agent: AgentEngagementStat;
  /** Full agent record from the same catalog the home grid uses. */
  catalogAgent?: Agent | null;
};

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** Compact agent row for analytics — logo markup matches `AgentCard`. */
export default function AnalyticsAgentCard({ agent, catalogAgent }: Props) {
  const title =
    catalogAgent?.displayName || catalogAgent?.name || agent.agentSlug;

  return (
    <Link
      href={`/agents/${encodeURIComponent(agent.agentSlug)}`}
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-md-outline/50 bg-md-surface-container/40',
        'px-3.5 py-3 transition-all duration-200',
        'hover:border-md-primary/40 hover:bg-md-surface-container hover:shadow-sm'
      )}
    >
      <div
        className={cn(
          'shrink-0 w-10 h-10 rounded-lg bg-md-surface-container border border-md-outline-variant/50 flex items-center justify-center overflow-hidden p-1.5',
          !catalogAgent?.logo && 'invisible'
        )}
      >
        {catalogAgent?.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- same as AgentCard
          <img
            src={catalogAgent.logo}
            alt={`${catalogAgent.displayName || catalogAgent.name} logo`}
            className="object-contain w-full h-full"
            onError={(e) => {
              const container = (e.target as HTMLImageElement).parentElement;
              if (container) container.style.display = 'none';
            }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-title-small text-md-on-surface truncate group-hover:text-md-primary transition-colors">
          {title}
        </p>
        <p className="text-label-small text-md-on-surface-variant/70 tabular-nums truncate">
          {formatCount(agent.messages)} msgs · {formatActiveLabel(agent.activeMs)}
        </p>
      </div>
    </Link>
  );
}
