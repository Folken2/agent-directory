'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Agent } from '@/lib/types';
import { adkClient } from '@/lib/adk-client';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AgentCard from './AgentCard';
import {
  AlertCircle,
  Search,
  ArrowUpDown,
  ChevronDown,
  Check,
  Sparkles,
  Star,
  Type,
} from 'lucide-react';

type SortOption = 'featured' | 'mostStarred' | 'name';

const COMMUNITY_WRITES = process.env.NEXT_PUBLIC_COMMUNITY_WRITE_ENABLED === 'true';

export default function AgentGrid() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listWarning, setListWarning] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('featured');
  const starSessionIdRef = useRef<string>('');

  const starredAgents = useAppStore((state) => state.starredAgents);
  const toggleStarAgent = useAppStore((state) => state.toggleStarAgent);
  const isAgentStarred = useAppStore((state) => state.isAgentStarred);
  const loadStarredAgents = useAppStore((state) => state.loadStarredAgents);

  const sortOptions = [
    {
      value: 'featured' as SortOption,
      label: 'Featured',
      description: 'Starred agents first, then most popular.',
      icon: Sparkles,
    },
    {
      value: 'mostStarred' as SortOption,
      label: 'Most starred',
      description: 'Sort by community favorites.',
      icon: Star,
    },
    {
      value: 'name' as SortOption,
      label: 'Name (A–Z)',
      description: 'Alphabetical by display name.',
      icon: Type,
    },
  ];

  const activeSortOption = sortOptions.find((option) => option.value === sortOption) ?? sortOptions[0];

  useEffect(() => {
    const loadAgents = async () => {
      setIsLoading(true);
      try {
        const { agents: agentList, warning } = await adkClient.listAgentsDetailed();
        setListWarning(warning ?? null);
        setAgents(
          agentList.map((agent) => ({
            ...agent,
            starsCount: agent.starsCount ?? 0,
            tags: agent.tags ?? [],
            useCases: agent.useCases ?? [],
            samplePrompts: agent.samplePrompts ?? [],
          }))
        );
        loadStarredAgents();
      } catch (error) {
        console.error('Error loading agents:', error);
        setListWarning('Could not load the agent directory. Please try again in a moment.');
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, [loadStarredAgents]);

  const getStarSessionId = () => {
    if (starSessionIdRef.current) return starSessionIdRef.current;
    if (typeof window === 'undefined') return '';
    const key = 'adk-star-session-id';
    const existing = localStorage.getItem(key);
    if (existing) {
      starSessionIdRef.current = existing;
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, generated);
    starSessionIdRef.current = generated;
    return generated;
  };

  const handleToggleStar = async (agent: Agent) => {
    const currentlyStarred = isAgentStarred(agent.name);
    const action = currentlyStarred ? 'unstar' : 'star';
    const sessionId = getStarSessionId();

    toggleStarAgent(agent.name);
    setAgents((prev) =>
      prev.map((item) =>
        item.name === agent.name
          ? {
            ...item,
            starsCount: Math.max(0, (item.starsCount ?? 0) + (action === 'star' ? 1 : -1)),
          }
          : item
      )
    );

    try {
      const response = await fetch(`/api/agents/${agent.name}/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sessionId }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to update star');
      }

      if (typeof result?.data?.starsCount === 'number') {
        setAgents((prev) =>
          prev.map((item) =>
            item.name === agent.name
              ? { ...item, starsCount: result.data.starsCount }
              : item
          )
        );
      }
    } catch (error) {
      console.warn('Star update failed, reverting local state.', error);
      toggleStarAgent(agent.name);
      setAgents((prev) =>
        prev.map((item) =>
          item.name === agent.name
            ? {
              ...item,
              starsCount: Math.max(
                0,
                (item.starsCount ?? 0) + (action === 'star' ? -1 : 1)
              ),
            }
            : item
        )
      );
    }
  };

  const filteredAgents = useMemo(() => {
    let filtered = agents;

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((agent) => {
        const useCaseStrings = (agent.useCases || []).map(
          (uc) => `${uc.title} ${uc.description}`
        );
        const haystack = [
          agent.name,
          agent.displayName,
          agent.description,
          agent.author,
          agent.category,
          ...(agent.tools || []),
          ...(agent.tags || []),
          ...useCaseStrings,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(term);
      });
    }

    return filtered;
  }, [agents, searchTerm]);

  const sortedAgents = useMemo(() => {
    const sorter = [...filteredAgents];
    sorter.sort((a, b) => {
      const aStarred = starredAgents.includes(a.name);
      const bStarred = starredAgents.includes(b.name);
      const aStars = a.starsCount ?? 0;
      const bStars = b.starsCount ?? 0;

      if (sortOption === 'mostStarred') {
        if (bStars !== aStars) return bStars - aStars;
        return a.name.localeCompare(b.name);
      }

      if (sortOption === 'name') {
        return a.displayName?.localeCompare(b.displayName || b.name) ?? a.name.localeCompare(b.name);
      }

      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      if (bStars !== aStars) return bStars - aStars;
      return a.name.localeCompare(b.name);
    });
    return sorter;
  }, [filteredAgents, sortOption, starredAgents]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Loading agents… If the directory backend was cold, this may take a few minutes.
        </p>
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
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-24 bg-muted/20 rounded-3xl border border-dashed border-border">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-muted rounded-full">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">No agents available</p>
            <p className="text-sm text-muted-foreground mt-1">
              {listWarning ||
                'The directory backend may still be warming up. Refresh in a moment.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {listWarning ? (
        <p
          role="status"
          className="mb-4 text-sm text-muted-foreground border border-border/70 bg-muted/30 rounded-xl px-4 py-3"
        >
          {listWarning}
        </p>
      ) : null}
      <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-md-on-surface-variant/70" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search agents by name, description, tools..."
            className="w-full pl-10 pr-3 py-3 rounded-xl bg-md-surface text-body-medium text-md-on-surface placeholder:text-md-on-surface-variant/50 border border-md-outline/80 focus:outline-none focus:ring-2 focus:ring-md-primary/20 focus:border-md-primary transition-all shadow-sm focus:shadow-md"
          />
        </div>

        <div className="flex items-center gap-3 justify-end md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outlined" size="sm" aria-label={`Sort: ${activeSortOption.label}`} className="group">
                <ArrowUpDown className="w-4 h-4" />
                <span>{activeSortOption.label}</span>
                <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              {sortOptions.map((option) => {
                const Icon = option.icon;
                const isActive = sortOption === option.value;
                return (
                  <DropdownMenuItem
                    key={option.value}
                    className="h-auto py-2"
                    onSelect={() => setSortOption(option.value)}
                  >
                    <Icon />
                    <div className="flex-1">
                      <div className="text-label-large text-md-on-surface">{option.label}</div>
                      <div className="text-label-small text-md-on-surface-variant">{option.description}</div>
                    </div>
                    {isActive ? <Check aria-label="Selected" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {sortedAgents.map((agent) => (
          <AgentCard
            key={agent.name}
            agent={agent}
            isStarred={isAgentStarred(agent.name)}
            onToggleStar={COMMUNITY_WRITES ? () => handleToggleStar(agent) : undefined}
          />
        ))}
      </div>
    </>
  );
}
