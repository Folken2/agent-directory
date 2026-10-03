'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Agent } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { COMMUNITY_WRITES, fetchStarCounts, postStar } from '@/lib/stars-client';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AgentCard from './AgentCard';

type SortOption = 'featured' | 'mostStarred' | 'name';

const SORT_LABELS: Record<SortOption, string> = {
  featured: 'Featured',
  mostStarred: 'Most starred',
  name: 'Name',
};

interface AgentGridProps {
  /** The examples to show, rendered on the server from the bundled catalog. */
  agents: Agent[];
  /** Show only the first N agents of the default ordering. */
  limit?: number;
  /** Search, category and sort controls (off for compact previews). */
  showControls?: boolean;
}

/** Categories in order of how many examples use them, then by name. */
function categoriesOf(agents: Agent[]): string[] {
  const counts = new Map<string, number>();
  for (const a of agents) if (a.category) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

function matches(agent: Agent, term: string): boolean {
  if (!term) return true;
  return [
    agent.name,
    agent.displayName,
    agent.description,
    agent.author,
    agent.category,
    ...(agent.tools ?? []),
    ...(agent.tags ?? []),
    ...(agent.useCases ?? []).map((uc) => `${uc.title} ${uc.description}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(term);
}

export default function AgentGrid({ agents: initialAgents, limit, showControls = true }: AgentGridProps) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('featured');

  const starredAgents = useAppStore((state) => state.starredAgents);
  const toggleStarAgent = useAppStore((state) => state.toggleStarAgent);
  const loadStarredAgents = useAppStore((state) => state.loadStarredAgents);

  useEffect(() => {
    if (!COMMUNITY_WRITES) return;
    loadStarredAgents();
    let cancelled = false;
    void fetchStarCounts().then((counts) => {
      if (cancelled || counts.size === 0) return;
      setAgents((prev) => prev.map((a) => (counts.has(a.name) ? { ...a, starsCount: counts.get(a.name) } : a)));
    });
    return () => {
      cancelled = true;
    };
  }, [loadStarredAgents]);

  const setCount = (name: string, update: (count: number) => number) =>
    setAgents((prev) =>
      prev.map((a) => (a.name === name ? { ...a, starsCount: Math.max(0, update(a.starsCount ?? 0)) } : a))
    );

  const handleToggleStar = async (agent: Agent) => {
    const action = starredAgents.includes(agent.name) ? 'unstar' : 'star';
    const delta = action === 'star' ? 1 : -1;
    toggleStarAgent(agent.name);
    setCount(agent.name, (c) => c + delta);
    try {
      const count = await postStar(agent.name, action);
      if (count !== null) setCount(agent.name, () => count);
    } catch (error) {
      console.warn('Star update failed, reverting local state.', error);
      toggleStarAgent(agent.name);
      setCount(agent.name, (c) => c - delta);
    }
  };

  const categories = useMemo(() => categoriesOf(agents), [agents]);

  const visibleAgents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = agents.filter((a) => (!category || a.category === category) && matches(a, term));
    list.sort((a, b) => {
      const aStars = a.starsCount ?? 0;
      const bStars = b.starsCount ?? 0;
      if (sortOption === 'name') {
        return (a.displayName || a.name).localeCompare(b.displayName || b.name);
      }
      if (sortOption === 'featured') {
        const aStarred = starredAgents.includes(a.name);
        const bStarred = starredAgents.includes(b.name);
        if (aStarred !== bStarred) return aStarred ? -1 : 1;
      }
      if (bStars !== aStars) return bStars - aStars;
      return a.name.localeCompare(b.name);
    });
    return limit ? list.slice(0, limit) : list;
  }, [agents, category, searchTerm, sortOption, starredAgents, limit]);

  if (agents.length === 0) {
    return (
      <p role="status" className="py-12 text-center text-body-medium text-md-on-surface-variant">
        No examples are available right now.
      </p>
    );
  }

  return (
    <>
      {showControls ? (
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-full md:max-w-md">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-md-on-surface-variant"
                aria-hidden
              />
              <Input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search examples"
                aria-label="Search examples"
                className="pl-11"
              />
            </div>
            {COMMUNITY_WRITES ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="text" size="sm" className="ml-auto shrink-0 text-md-on-surface-variant" aria-label={`Sort: ${SORT_LABELS[sortOption]}`}>
                    {SORT_LABELS[sortOption]}
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[180px]">
                  <DropdownMenuRadioGroup value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {SORT_LABELS[option]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          {categories.length > 1 ? (
            <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
              <Chip variant="filter" selected={category === null} onClick={() => setCategory(null)}>
                All
              </Chip>
              {categories.map((c) => (
                <Chip key={c} variant="filter" selected={category === c} onClick={() => setCategory(category === c ? null : c)}>
                  {c}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleAgents.length === 0 ? (
        <p role="status" className="py-12 text-center text-body-medium text-md-on-surface-variant">
          {searchTerm.trim() ? `No examples match “${searchTerm.trim()}”.` : 'No examples in this category.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleAgents.map((agent) => (
            <AgentCard
              key={agent.name}
              agent={agent}
              isStarred={starredAgents.includes(agent.name)}
              onToggleStar={COMMUNITY_WRITES ? () => void handleToggleStar(agent) : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
