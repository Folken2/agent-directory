'use client';

import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { Agent } from '@/lib/types';

interface EmptyStateProps {
  agent: Agent | null;
  onPromptClick: (prompt: string) => void;
}

export default function EmptyState({ agent, onPromptClick }: EmptyStateProps) {
  const prompts = agent?.samplePrompts?.slice(0, 6) ?? [];
  const extra = (agent?.samplePrompts?.length ?? 0) - prompts.length;
  const greeting = agent?.displayName || agent?.name || 'this agent';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
        <Bot className="w-6 h-6" strokeWidth={2} />
      </div>

      <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground">
        Chat with {greeting}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        {agent?.description || 'Start a conversation. Use sample prompts below or write your own.'}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground/60">Powered by Gemini 3 Flash</p>

      {prompts.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 items-center w-full">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            <Sparkles className="w-3 h-3" />
            Try one of these
          </span>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
            {prompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => onPromptClick(prompt)}
                className="px-3.5 py-2 rounded-full text-xs text-foreground/90 bg-muted/40 border border-border/50 hover:border-primary/40 hover:bg-muted/70 hover:text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
            {extra > 0 && (
              <span className="text-[11px] text-muted-foreground self-center">
                +{extra} more in agent details
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
