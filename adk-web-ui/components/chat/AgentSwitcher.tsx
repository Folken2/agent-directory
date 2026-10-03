'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { Agent } from '@/lib/types';
import { BUILDER_AGENT } from '@/lib/builder';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Chat header title that doubles as an agent picker; switching starts a fresh chat. */
export default function AgentSwitcher({ agent }: { agent: Agent | null }) {
  const router = useRouter();
  const agents = useAppStore((s) => s.agents);
  const setAgents = useAppStore((s) => s.setAgents);
  const [loading, setLoading] = useState(false);

  const loadAgents = async () => {
    if (agents.length > 0 || loading) return;
    setLoading(true);
    try {
      const r = await fetch('/api/agents');
      const j = r.ok ? await r.json() : null;
      if (Array.isArray(j?.data)) setAgents(j.data as Agent[]);
    } catch {
      // Menu shows the current agent only.
    } finally {
      setLoading(false);
    }
  };

  // Builder first, then the examples in directory order.
  const list = [...agents].sort((a, b) => Number(b.name === BUILDER_AGENT) - Number(a.name === BUILDER_AGENT));
  const label = agent ? agent.displayName || agent.name : 'Loading…';

  return (
    <DropdownMenu onOpenChange={(open) => open && void loadAgents()}>
      <DropdownMenuTrigger
        className="ml-1 inline-flex min-w-0 items-center gap-1 rounded-full px-3 py-1.5 text-[15px] font-semibold tracking-tight text-md-on-surface transition-colors hover:bg-md-on-surface/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
        aria-label={`Agent: ${label}. Switch agent`}
      >
        <span className="truncate max-w-[50vw] sm:max-w-md">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-md-on-surface-variant" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-72 overflow-y-auto">
        <DropdownMenuLabel>Switch agent</DropdownMenuLabel>
        {list.length === 0 ? (
          <DropdownMenuLabel>{loading ? 'Loading agents…' : 'No other agents available'}</DropdownMenuLabel>
        ) : (
          <DropdownMenuRadioGroup
            value={agent?.name}
            onValueChange={(name) => {
              if (name !== agent?.name) router.push(`/chat?agent=${encodeURIComponent(name)}`);
            }}
          >
            {list.map((a) => (
              <DropdownMenuRadioItem key={a.name} value={a.name}>
                {a.displayName || a.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
