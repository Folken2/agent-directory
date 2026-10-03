import type { Metadata } from 'next';
import AgentGrid from '@/components/AgentGrid';
import { loadExampleAgents } from '@/lib/agent-catalog';

export const metadata: Metadata = {
  title: 'Example agents | ADK Agent Directory',
  description:
    "Working example agents built with Google's Agent Development Kit (ADK). Try them free in the browser. Independent project, not affiliated with Google.",
  alternates: { canonical: '/examples' },
};

export default function ExamplesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <h1 className="text-headline-large tracking-tight text-md-on-surface">Examples</h1>
      <p className="mb-8 mt-2 max-w-2xl text-body-large text-md-on-surface-variant">
        Agents built with the Agent Development Kit. Open one to see what it does, then try it in chat.
      </p>
      <AgentGrid agents={loadExampleAgents()} />
    </div>
  );
}
