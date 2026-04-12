'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Agent } from '@/lib/types';
import { adkClient } from '@/lib/adk-client';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import AgentCard from './AgentCard';
import { FilterState } from './AdvancedFilters';
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

export default function AgentGrid() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('featured');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ useCases: [], tags: [], tools: [] });
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
        const agentList = await adkClient.listAgents();
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
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, [loadStarredAgents]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSortMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleSelectSort = (option: SortOption) => {
    setSortOption(option);
    setIsSortMenuOpen(false);
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

    if (filters.useCases.length > 0) {
      filtered = filtered.filter((agent) =>
        agent.useCases && agent.useCases.some((uc) => filters.useCases.includes(uc.description))
      );
    }

    if (filters.tags.length > 0) {
      filtered = filtered.filter((agent) =>
        agent.tags && agent.tags.some((tag) => filters.tags.includes(tag))
      );
    }

    if (filters.tools.length > 0) {
      filtered = filtered.filter((agent) =>
        agent.tools && agent.tools.some((tool) => filters.tools.includes(tool))
      );
    }

    return filtered;
  }, [agents, searchTerm, filters]);

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
              Make sure the ADK server is running and agents are registered.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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
          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={isSortMenuOpen}
              onClick={() => setIsSortMenuOpen((open) => !open)}
              className="group flex h-[44px] items-center gap-2 rounded-xl bg-md-surface border border-md-outline/80 hover:bg-md-surface-container hover:border-md-outline text-md-on-surface px-4 py-2 text-label-large transition-all focus-visible:ring-2 focus-visible:ring-md-primary shadow-sm hover:shadow"
            >
              <ArrowUpDown className="w-4 h-4 text-md-on-surface-variant" />
              <span className="font-medium">{activeSortOption.label}</span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-md-on-surface-variant/70 transition-transform duration-200',
                  isSortMenuOpen && 'rotate-180'
                )}
              />
            </button>

            <AnimatePresence>
              {isSortMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsSortMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-md-outline bg-md-surface elevation-3"
                  >
                    <div className="p-2">
                      {sortOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = sortOption === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onClick={() => handleSelectSort(option.value)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-all',
                              'hover:bg-md-surface-variant focus-visible:ring-2 focus-visible:ring-md-primary',
                              isActive && 'bg-md-primary-container'
                            )}
                          >
                            <div
                              className={cn(
                                'rounded-lg p-2',
                                isActive ? 'bg-md-primary text-md-on-primary' : 'bg-md-surface-container text-md-on-surface-variant'
                              )}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <div className="text-label-large text-md-on-surface">{option.label}</div>
                              <div className="text-label-small text-md-on-surface-variant">{option.description}</div>
                            </div>
                            {isActive && <Check className="w-4 h-4 text-md-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {sortedAgents.map((agent) => (
          <AgentCard
            key={agent.name}
            agent={agent}
            isStarred={isAgentStarred(agent.name)}
            onToggleStar={() => handleToggleStar(agent)}
          />
        ))}
      </div>
    </>
  );
}
