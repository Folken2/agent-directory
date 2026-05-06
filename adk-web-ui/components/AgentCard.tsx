'use client';

import { Agent } from '@/lib/types';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryColors } from '@/lib/category-colors';
import Link from 'next/link';

interface AgentCardProps {
  agent: Agent;
  onToggleStar: () => void;
  isStarred: boolean;
}

export default function AgentCard({ agent, onToggleStar, isStarred }: AgentCardProps) {
  const handleStarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleStar();
  };

  const categoryColors = getCategoryColors(agent.category);

  return (
    <Link
      href={`/agents/${agent.name}`}
      className="group relative flex h-full flex-col rounded-2xl bg-md-surface border border-md-outline/60 p-5 transition-colors duration-200 hover:border-md-primary/40 hover:bg-md-surface-bright"
    >
      {/* Header: avatar + star */}
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'shrink-0 w-9 h-9 rounded-xl bg-md-surface-container flex items-center justify-center overflow-hidden p-1.5',
            !agent.logo && 'invisible',
          )}
        >
          {agent.logo && (
            <img
              src={agent.logo}
              alt={`${agent.displayName || agent.name} logo`}
              className="object-contain w-full h-full"
              onError={(e) => {
                const container = (e.target as HTMLImageElement).parentElement;
                if (container) container.style.display = 'none';
              }}
            />
          )}
        </div>

        <button
          type="button"
          onClick={handleStarClick}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
            isStarred
              ? 'text-md-tertiary'
              : 'text-md-on-surface-variant hover:text-md-tertiary',
          )}
          aria-label={isStarred ? 'Unstar agent' : 'Star agent'}
        >
          <Star className={cn('w-3.5 h-3.5', isStarred && 'fill-current')} />
          <span className="tabular-nums">{agent.starsCount ?? 0}</span>
        </button>
      </div>

      {/* Title */}
      <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-md-on-surface line-clamp-2 leading-snug group-hover:text-md-primary transition-colors duration-200">
        {agent.displayName || agent.name}
      </h3>

      {/* Category — single subtle line, dot + label, no bg/border */}
      {agent.category && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', categoryColors.dot ?? 'bg-md-primary')} />
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-md-on-surface-variant">
            {agent.category}
          </span>
        </div>
      )}

      {/* Description */}
      <p className="mt-3 text-sm text-md-on-surface-variant leading-relaxed line-clamp-4 flex-1">
        {agent.description || 'No description available'}
      </p>

      {/* Footer: tags + author on one line */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {agent.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium text-md-on-surface-variant/80 truncate"
            >
              {tag}
            </span>
          ))}
          {agent.tags && agent.tags.length > 3 && (
            <span className="text-[11px] text-md-on-surface-variant/60">
              +{agent.tags.length - 3}
            </span>
          )}
        </div>
        {agent.author && (
          <span className="font-serif-accent text-[12px] text-md-on-surface-variant/70 truncate shrink-0 max-w-[40%]">
            by {agent.author}
          </span>
        )}
      </div>
    </Link>
  );
}
