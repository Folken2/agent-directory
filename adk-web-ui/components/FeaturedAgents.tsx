'use client';

import { useEffect, useState } from 'react';
import { Agent } from '@/lib/types';
import { adkClient } from '@/lib/adk-client';
import { useAppStore } from '@/lib/store';
import AgentCard from './AgentCard';
import { Sparkles } from 'lucide-react';

export default function FeaturedAgents() {
  const [featuredAgents, setFeaturedAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toggleStarAgent, isAgentStarred } = useAppStore();

  useEffect(() => {
    const loadAgents = async () => {
      setIsLoading(true);
      try {
        const agentList = await adkClient.listAgents();
        const agents = agentList.map((agent) => ({
          ...agent,
          starsCount: agent.starsCount ?? 0,
          tags: agent.tags ?? [],
          useCases: agent.useCases ?? [],
          samplePrompts: agent.samplePrompts ?? [],
        }));

        // Featured agents: most starred, limit to 4
        const featured = [...agents]
          .sort((a, b) => (b.starsCount ?? 0) - (a.starsCount ?? 0))
          .slice(0, 4);

        setFeaturedAgents(featured);
      } catch (error) {
        console.error('Error loading featured agents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-2xl border border-border p-6 animate-pulse"
          >
            <div className="h-6 bg-muted rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-muted rounded w-full mb-2"></div>
            <div className="h-4 bg-muted rounded w-5/6 mb-6"></div>
            <div className="h-4 bg-muted rounded w-1/2 mt-auto"></div>
          </div>
        ))}
      </div>
    );
  }

  if (featuredAgents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Featured Agents</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {featuredAgents.map((agent) => (
          <AgentCard
            key={agent.name}
            agent={agent}
            isStarred={isAgentStarred(agent.name)}
            onToggleStar={() => toggleStarAgent(agent.name)}
          />
        ))}
      </div>
    </div>
  );
}

