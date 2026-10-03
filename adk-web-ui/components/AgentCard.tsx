'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { Agent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import AgentLogo from '@/components/agent/AgentLogo';

interface AgentCardProps {
  agent: Agent;
  /** Present only when community stars are enabled. */
  onToggleStar?: () => void;
  isStarred: boolean;
}

export default function AgentCard({ agent, onToggleStar, isStarred }: AgentCardProps) {
  const name = agent.displayName || agent.name;
  const stars = agent.starsCount ?? 0;

  return (
    // The title link stretches over the whole card (after:inset-0) so the star
    // button can sit above it without nesting interactive elements.
    <Card interactive className="group relative flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        <AgentLogo src={agent.logo} name={name} size="sm" />
        <h3 className="min-w-0 flex-1 text-title-medium tracking-tight text-md-on-surface line-clamp-2">
          <Link
            href={`/agents/${encodeURIComponent(agent.name)}`}
            className="after:absolute after:inset-0 after:rounded-[var(--md-shape-lg)] focus-visible:outline-none"
          >
            {name}
          </Link>
        </h3>
      </div>

      <p className="mt-3 flex-1 text-body-medium text-md-on-surface-variant line-clamp-3">
        {agent.description}
      </p>

      <div className="mt-4 flex h-8 items-center justify-between gap-2 text-label-medium text-md-on-surface-variant">
        <span className="truncate">{agent.category}</span>
        {onToggleStar ? (
          <button
            type="button"
            onClick={onToggleStar}
            className={cn(
              'relative z-10 -mr-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
              isStarred ? 'text-md-primary' : 'hover:bg-md-on-surface/8 hover:text-md-on-surface'
            )}
            aria-label={isStarred ? `Unstar ${name}` : `Star ${name}`}
            aria-pressed={isStarred}
          >
            <Star className={cn('size-4', isStarred && 'fill-current')} aria-hidden />
            {stars > 0 ? stars : null}
          </button>
        ) : null}
      </div>
    </Card>
  );
}
