import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import AgentGrid from '@/components/AgentGrid';
import BuilderHero from '@/components/home/BuilderHero';
import { Page, Section } from '@/components/layout/Page';
import { loadExampleAgents } from '@/lib/agent-catalog';

const moreLink =
  'inline-flex items-center gap-1 rounded-full text-label-large text-md-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary';

export default function Home() {
  const examples = loadExampleAgents();

  return (
    <Page className="pt-16 sm:pt-28">
      <section className="pb-8 sm:pb-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-display-small tracking-tight text-md-on-surface sm:text-display-medium">
            What agent do you want to build?
          </h1>
          <p className="mx-auto mb-10 mt-4 max-w-xl text-body-large text-md-on-surface-variant">
            Describe it in a sentence. The agent builder designs it with you on Google&apos;s Agent
            Development Kit, then builds it: a production-ready project you download and run.
          </p>
        </div>
        <BuilderHero />
      </section>

      <Section
        id="examples"
        title="Examples"
        description="Working agents built with ADK. Try one now, no account needed."
        action={
          <Link href="/examples" className={moreLink}>
            Browse all examples
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        }
      >
        <AgentGrid agents={examples} limit={4} showControls={false} />
      </Section>

      <section className="mt-20 flex flex-col gap-4 border-t border-md-outline/60 pt-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-body-large text-md-on-surface-variant">
          Built in the open with Google&apos;s Agent Development Kit. The site and every example are open source.
        </p>
        <Link href="/about" className={moreLink}>
          About the project
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </Page>
  );
}
