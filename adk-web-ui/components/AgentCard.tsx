'use client';

import Link from 'next/link';
import { Star, User } from 'lucide-react';
import { Agent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';

interface AgentCardProps {
  agent: Agent;
  onToggleStar?: () => void;
  isStarred: boolean;
}

export default function AgentCard({ agent, onToggleStar, isStarred }: AgentCardProps) {
  const name = agent.displayName || agent.name;
  const stars = agent.starsCount ?? 0;
  const tags = agent.tags ?? [];

  return (
    // The title link stretches over the whole card (after:inset-0) so the star
    // button can sit above it without nesting interactive elements.
    <Card
      variant="outlined"
      interactive
      className="group relative flex h-full flex-col gap-4 border-md-outline-variant p-5"
    >
      <div className="flex items-start gap-3">
        {agent.logo ? (
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--md-shape-md)] bg-md-surface-container p-1.5">
            <img
              src={agent.logo}
              alt=""
              className="h-full w-full object-contain"
              onError={(e) => {
                const container = (e.target as HTMLImageElement).parentElement;
                if (container) container.style.display = 'none';
              }}
            />
          </div>
        ) : null}
        <h3 className="min-w-0 flex-1 text-title-medium tracking-tight text-md-on-surface line-clamp-2">
          <Link
            href={`/agents/${encodeURIComponent(agent.name)}`}
            className="after:absolute after:inset-0 after:rounded-[var(--md-shape-lg)] focus-visible:outline-none group-hover:text-md-primary"
          >
            {name}
          </Link>
        </h3>
        {onToggleStar ? (
          <button
            type="button"
            onClick={onToggleStar}
            className={cn(
              'relative z-10 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-label-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
              isStarred
                ? 'bg-md-tertiary-container text-md-on-tertiary-container'
                : 'text-md-on-surface-variant hover:bg-md-on-surface/8'
            )}
            aria-label={isStarred ? `Unstar ${name}` : `Star ${name}`}
            aria-pressed={isStarred}
          >
            <Star className={cn('size-4', isStarred && 'fill-current')} />
            {stars}
          </button>
        ) : (
          <span className="inline-flex h-8 shrink-0 items-center gap-1.5 px-2 text-label-medium text-md-on-surface-variant">
            <Star className="size-4" aria-hidden />
            <span className="sr-only">Stars:</span>
            {stars}
          </span>
        )}
      </div>

      {agent.category ? (
        <div>
          <Chip variant="category">{agent.category}</Chip>
        </div>
      ) : null}

      <p className="flex-1 text-body-medium leading-relaxed text-md-on-surface-variant line-clamp-4">
        {agent.description || 'No description available'}
      </p>

      {tags.length > 0 ? (
        <p className="text-label-medium text-md-on-surface-variant line-clamp-1">
          {tags.slice(0, 3).join(' · ')}
          {tags.length > 3 ? ` +${tags.length - 3}` : ''}
        </p>
      ) : null}

      {agent.author ? (
        <div className="flex items-center gap-1.5 border-t border-md-outline-variant pt-3 text-label-medium text-md-on-surface-variant">
          <User className="size-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-1">{agent.author}</span>
        </div>
      ) : null}
    </Card>
  );
}
