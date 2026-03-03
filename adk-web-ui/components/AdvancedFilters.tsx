'use client';

import { useState } from 'react';
import { Agent } from '@/lib/types';
import { getAllUseCases } from '@/lib/use-case-utils';
import { Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdvancedFiltersProps {
  agents: Agent[];
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  useCases: string[];
  tags: string[];
  tools: string[];
}

export default function AdvancedFilters({ agents, onFilterChange }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    useCases: [],
    tags: [],
    tools: [],
  });

  const allUseCases = getAllUseCases(agents);
  const allTags = Array.from(new Set(agents.flatMap(a => a.tags || []))).sort();
  const allTools = Array.from(new Set(agents.flatMap(a => a.tools || []))).sort();

  const handleFilterToggle = (category: keyof FilterState, value: string) => {
    const newFilters = { ...filters };
    const currentValues = newFilters[category];
    
    if (currentValues.includes(value)) {
      newFilters[category] = currentValues.filter(v => v !== value);
    } else {
      newFilters[category] = [...currentValues, value];
    }
    
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters: FilterState = { useCases: [], tags: [], tools: [] };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters = filters.useCases.length > 0 || filters.tags.length > 0 || filters.tools.length > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
          isOpen || hasActiveFilters
            ? "bg-primary/10 border-primary/40 text-primary"
            : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters</span>
        {hasActiveFilters && (
          <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs font-medium">
            {filters.useCases.length + filters.tags.length + filters.tools.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 bg-card rounded-xl border border-border shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Filters</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mb-4 text-sm text-primary hover:underline"
              >
                Clear all filters
              </button>
            )}

            <div className="space-y-6 max-h-96 overflow-y-auto">
              {/* Use Cases */}
              {allUseCases.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Use Cases</h4>
                  <div className="space-y-2">
                    {allUseCases.map((useCase) => (
                      <label
                        key={useCase}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filters.useCases.includes(useCase)}
                          onChange={() => handleFilterToggle('useCases', useCase)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-muted-foreground">{useCase}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {allTags.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Tags</h4>
                  <div className="space-y-2">
                    {allTags.map((tag) => (
                      <label
                        key={tag}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filters.tags.includes(tag)}
                          onChange={() => handleFilterToggle('tags', tag)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-muted-foreground">{tag}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools */}
              {allTools.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Tools</h4>
                  <div className="space-y-2">
                    {allTools.map((tool) => (
                      <label
                        key={tool}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={filters.tools.includes(tool)}
                          onChange={() => handleFilterToggle('tools', tool)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-muted-foreground">{tool}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

