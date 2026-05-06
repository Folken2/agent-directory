'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Agent } from '@/lib/types';

interface EmptyStateProps {
  agent: Agent | null;
  onPromptClick: (prompt: string) => void;
}

export default function EmptyState({ agent, onPromptClick }: EmptyStateProps) {
  const prompts = agent?.samplePrompts?.slice(0, 6) ?? [];
  const extra = (agent?.samplePrompts?.length ?? 0) - prompts.length;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-16">
      <h2 className="text-3xl font-light tracking-tight text-foreground">How can I help you today?</h2>

      {prompts.length > 0 && (
        <div className="flex flex-col gap-3 items-center">
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            Try this
          </span>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
            {prompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onPromptClick(prompt)}
                className="px-3.5 py-2 rounded-full text-xs bg-muted/60 text-foreground border border-border/60 hover:border-primary/40 hover:bg-muted transition-colors"
              >
                {prompt}
              </button>
            ))}
            {extra > 0 && (
              <span className="text-[11px] text-muted-foreground self-center">+{extra} more in agent details</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
