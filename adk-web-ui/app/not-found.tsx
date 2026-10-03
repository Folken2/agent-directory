import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import AgentGrid from '@/components/AgentGrid';
import BuilderHero from '@/components/home/BuilderHero';
import { Page, PageHeader, Section } from '@/components/layout/Page';
import { loadExampleAgents } from '@/lib/agent-catalog';

export default function NotFound() {
  return (
    <Page>
      <PageHeader
        title="Page not found"
        description="Error 404. The link may be broken, or the page may have moved. You can pick up from here instead."
      />

      <div className="max-w-2xl">
        <BuilderHero compact label="Describe the agent you were looking for" placeholder="Describe the agent you were looking for…" />
      </div>

      <Section
        title="Or start from an example"
        className="mt-16"
        action={
          <Link
            href="/examples"
            className="inline-flex items-center gap-1 rounded-full text-label-large text-md-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
          >
            Browse all examples
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      >
        <AgentGrid agents={loadExampleAgents()} limit={4} showControls={false} />
      </Section>
    </Page>
  );
}
