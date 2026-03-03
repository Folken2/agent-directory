'use client';

import { useAppStore } from '@/lib/store';
import { Bot, Wrench } from 'lucide-react';

export default function AgentInfo() {
  const { selectedAgent } = useAppStore();

  if (!selectedAgent) {
    return (
      <div className="p-6 bg-muted/30 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-center h-full min-h-[200px]">
        <div className="p-3 bg-muted rounded-full mb-3">
          <Bot className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Select an agent to view details</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card rounded-2xl border border-border shadow-sm h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary/5 rounded-lg">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground tracking-tight">
          {selectedAgent.name}
        </h3>
      </div>

      <div className="mb-6">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {selectedAgent.description || 'No description available'}
        </p>
      </div>

      {selectedAgent.tools && selectedAgent.tools.length > 0 && (
        <div className="pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-3 h-3 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Available Tools
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedAgent.tools.map((tool) => (
              <span
                key={tool}
                className="px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-md border border-border/50"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

