'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Agent } from '@/lib/types';

interface EmptyStateProps {
  agent: Agent | null;
  onPromptClick: (prompt: string) => void;
}

export default function EmptyState({ agent, onPromptClick }: EmptyStateProps) {
  const prompts = agent?.samplePrompts?.slice(0, 2) ?? [];
  const greeting = agent?.displayName || agent?.name || 'this agent';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 overflow-hidden p-1.5">
        {agent?.logo ? (
          <img
            src={agent.logo}
            alt=""
            className="h-full w-full object-contain"
          />
        ) : (
          <Sparkles className="w-5 h-5" strokeWidth={1.75} />
        )}
      </div>

      <h2 className="text-2xl font-medium tracking-tight text-foreground">
        Chat with {greeting}
      </h2>

      {agent?.description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-sm line-clamp-2">
          {agent.description}
        </p>
      )}

      {prompts.length > 0 && (
        <div className="mt-7 flex flex-wrap justify-center gap-2 max-w-xl">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptClick(prompt)}
              className="px-3.5 py-2 rounded-full text-xs text-foreground/90 bg-muted/40 border border-border/50 hover:border-primary/40 hover:bg-muted/70 hover:text-foreground transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
