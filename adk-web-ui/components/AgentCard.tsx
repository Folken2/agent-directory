'use client';

import { Agent } from '@/lib/types';
import { Star, User } from 'lucide-react';
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
      className="group bg-md-surface border border-md-outline/60 hover:border-md-primary/40 hover:shadow-elevation-3 rounded-2xl p-6 cursor-pointer transition-all duration-300 h-full flex flex-col relative overflow-hidden hover:-translate-y-1"
    >
      {/* Subtle Gradient Overlay on Hover */}
      <div className="absolute inset-0 bg-linear-to-br from-md-primary/0 to-md-primary/0 group-hover:from-md-primary/2 group-hover:to-md-primary/5 transition-all duration-300 pointer-events-none" />

      <div className="flex-1 flex flex-col relative z-1">
        {/* Header: Logo + Name + Star */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            "shrink-0 w-10 h-10 rounded-lg bg-md-surface-container border border-md-outline-variant/50 flex items-center justify-center overflow-hidden p-1.5",
            !agent.logo && "invisible"
          )}>
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
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-title-medium text-md-on-surface wrap-break-word tracking-tight group-hover:text-md-primary transition-colors duration-300 line-clamp-2">
                {agent.displayName || agent.name}
              </h3>
              <button
                type="button"
                onClick={handleStarClick}
                className={cn(
                  "text-xs font-medium backdrop-blur-sm rounded-full px-2.5 py-1 border flex items-center gap-1.5 transition-all duration-200 hover:scale-105 shrink-0 relative z-10",
                  isStarred
                    ? "bg-md-tertiary-container/50 border-md-tertiary/50 text-md-on-tertiary-container"
                    : "bg-md-surface-container-high/50 border-md-outline-variant text-md-on-surface-variant hover:border-md-tertiary/50"
                )}
                aria-label={isStarred ? 'Unstar agent' : 'Star agent'}
              >
                <Star
                  className={cn(
                    "w-3 h-3 transition-all duration-300",
                    isStarred
                      ? "text-md-tertiary fill-md-tertiary"
                      : "text-md-tertiary fill-md-tertiary/50"
                  )}
                />
                <span className={cn(
                  isStarred ? "text-md-on-tertiary-container" : "text-md-on-surface"
                )}>
                  {agent.starsCount ?? 0}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Badge */}
        {agent.category && (
          <div className="mb-4">
            <span className={cn(
              "inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold border tracking-wide",
              categoryColors.bg, categoryColors.text, categoryColors.border
            )}>
              {agent.category}
            </span>
          </div>
        )}

        {/* Description */}
        <p className="text-body-medium text-md-on-surface-variant line-clamp-3 leading-relaxed mb-5 flex-1">
          {agent.description || 'No description available'}
        </p>

        {/* Tags */}
        {agent.tags && agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1">
            {agent.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-md-surface-container text-md-on-surface-variant/70 border border-md-outline-variant/40"
              >
                {tag}
              </span>
            ))}
            {agent.tags.length > 3 && (
              <span className="px-2 py-0.5 text-[10px] text-md-on-surface-variant/50">
                +{agent.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer: Author */}
      <div className="mt-auto pt-4 border-t border-md-outline-variant/40 relative z-1">
        <div className="flex items-center gap-1.5">
          {agent.author && (
            <>
              <User className="w-3.5 h-3.5 text-md-on-surface-variant/70 shrink-0" />
              <span className="text-label-small text-md-on-surface-variant/70 tracking-wide uppercase line-clamp-1">
                {agent.author}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
