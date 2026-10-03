import type { Metadata } from 'next';
import AgentGrid from '@/components/AgentGrid';

export const metadata: Metadata = {
  title: 'Example agents | ADK Agent Directory',
  description:
    "Working example agents built with Google's Agent Development Kit (ADK). Try them free in the browser. Independent project, not affiliated with Google.",
  alternates: { canonical: '/examples' },
};

export default function ExamplesPage() {
  return (
    <div className="min-h-screen bg-md-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-display-small tracking-tight text-md-on-surface">Examples</h1>
        <p className="mb-10 mt-2 max-w-2xl text-body-large text-md-on-surface-variant">
          Agents built with the Agent Development Kit. Open one to see what it does, then try it in chat.
        </p>
        <AgentGrid />
      </div>
    </div>
  );
}
