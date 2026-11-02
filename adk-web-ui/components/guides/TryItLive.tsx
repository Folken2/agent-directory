import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCatalogAgent } from '@/lib/agent-catalog';
import { agentPath } from '@/lib/seo';
import { buttonVariants } from '@/components/ui/button';
import { panelClass } from '@/components/ui/card';
import AgentLogo from '@/components/agent/AgentLogo';

/** The guide's example agents: read how each is put together, or run it in chat. */
export default function TryItLive({ agents, className }: { agents: string[]; className?: string }) {
  const found = agents.flatMap((name) => getCatalogAgent(name) ?? []);
  if (found.length === 0) return null;

  return (
    // Rendered twice on guide pages (inline on mobile, sidebar on desktop), so no element ids.
    <section aria-label="Try it live" className={cn(panelClass, 'p-5', className)}>
      <h2 className="text-title-medium text-md-on-surface">Try it live</h2>
      <p className="mt-1 text-body-medium text-md-on-surface-variant">
        {found.length > 1 ? 'These agents use' : 'This agent uses'} the code in this guide. No account needed.
      </p>
      <ul className="mt-4 space-y-4">
        {found.map((agent) => (
          <li key={agent.name} className="flex items-start gap-3">
            <AgentLogo src={agent.logo} name={agent.displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <Link
                href={agentPath(agent.name)}
                className="text-title-small text-md-on-surface hover:text-md-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary rounded-sm"
              >
                {agent.displayName}
              </Link>
              <Link
                href={`/chat?agent=${encodeURIComponent(agent.name)}`}
                data-ga-event="try_agent"
                data-ga-agent={agent.name}
                className={cn(buttonVariants({ variant: 'tonal', size: 'sm' }), 'mt-2 flex w-fit')}
              >
                <MessageSquare />
                Try it in chat
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
