'use client';

import { Agent } from '@/lib/types';
import { Star, Wrench, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
  onToggleStar: () => void;
  isStarred: boolean;
}

export default function AgentCard({ agent, onClick, onToggleStar, isStarred }: AgentCardProps) {
  const handleStarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleStar();
  };

  const handleStarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link
      href={`/agents/${agent.name}`}
      className="group bg-md-surface border border-md-outline/60 hover:border-md-primary/40 hover:shadow-elevation-3 rounded-2xl p-6 cursor-pointer transition-all duration-300 h-full flex flex-col relative overflow-hidden hover:-translate-y-1"
      onClick={(e) => {
        // Allow star button to work without navigating
        const target = e.target as HTMLElement;
        const currentTarget = e.currentTarget as HTMLElement;
        // Check if click originated from or is inside a button
        if (target.closest('button') || currentTarget.querySelector('button')?.contains(target)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
        // Let Link handle navigation directly - don't open modal
      }}
    >
      {/* Subtle Gradient Overlay on Hover */}
      <div className="absolute inset-0 bg-linear-to-br from-md-primary/0 to-md-primary/0 group-hover:from-md-primary/2 group-hover:to-md-primary/5 transition-all duration-300 pointer-events-none" />

      <div className="flex-1 flex flex-col relative z-1">
        {/* Header Section - Fixed Height */}
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
                  if (container) {
                    container.style.display = 'none';
                  }
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
                onMouseDown={handleStarMouseDown}
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
        {/* Author Section - Fixed Height */}
        <div className="flex items-center gap-1.5 mb-4 min-h-[20px]">
          {agent.author ? (
            <>
              <User className="w-3.5 h-3.5 text-md-on-surface-variant/70 shrink-0" />
              <span className="text-label-small text-md-on-surface-variant/70 tracking-wide uppercase line-clamp-1">
                {agent.author}
              </span>
            </>
          ) : (
            <div className="h-3.5" />
          )}
        </div>

        {/* Description Section - Fixed Height */}
        <p className="text-body-medium text-md-on-surface-variant line-clamp-3 leading-relaxed mb-5 min-h-[72px]">
          {agent.description || 'No description available'}
        </p>

        {/* Tags Section - Fixed Height */}
        <div className="flex flex-wrap gap-2 min-h-[28px] mb-5">
          {agent.tags && agent.tags.length > 0 && (
            <>
              {agent.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-md-surface-container text-md-on-surface-variant border border-md-outline-variant/50"
                >
                  {tag}
                </span>
              ))}
              {agent.tags.length > 4 && (
                <span className="px-2.5 py-1 text-[11px] font-medium text-md-on-surface-variant/60">
                  +{agent.tags.length - 4}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tools Section - Always rendered with fixed height */}
      <div className="mt-auto pt-5 border-t border-md-outline-variant/40 relative z-1 min-h-[80px]">
        {agent.tools && agent.tools.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-3.5 h-3.5 text-md-on-surface-variant/60" />
              <h4 className="text-[10px] font-semibold text-md-on-surface-variant/60 uppercase tracking-widest">
                Tools
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.tools.slice(0, 3).map((tool) => (
                <span
                  key={tool}
                  className="px-2.5 py-1 text-[11px] font-medium bg-md-secondary-container/30 text-md-secondary-foreground/80 rounded-md border border-md-secondary/10 font-mono"
                >
                  {tool}
                </span>
              ))}
              {agent.tools.length > 3 && (
                <span className="px-2.5 py-1 text-[11px] text-md-on-surface-variant/60">
                  +{agent.tools.length - 3}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 mb-3 opacity-0 pointer-events-none">
            <Wrench className="w-3.5 h-3.5" />
            <h4 className="text-[10px] font-semibold uppercase tracking-widest">
              Tools
            </h4>
          </div>
        )}
      </div>
    </Link>
  );
}

