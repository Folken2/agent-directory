import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import AgentGrid from '@/components/AgentGrid';
import BuilderHero from '@/components/home/BuilderHero';
import { loadExampleAgents } from '@/lib/agent-catalog';

export default function Home() {
  const examples = loadExampleAgents();

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-display-small tracking-tight text-md-on-surface sm:text-display-medium">
            What agent do you want to build?
          </h1>
          <p className="mx-auto mb-10 mt-4 max-w-xl text-body-large text-md-on-surface-variant">
            Describe it in a sentence. The agent builder designs it with you using Google&apos;s Agent
            Development Kit: architecture, tools, prompts and code.
          </p>
        </div>
        <BuilderHero />
      </section>

      <section
        id="examples"
        aria-labelledby="examples-heading"
        className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="examples-heading" className="text-title-large tracking-tight text-md-on-surface">
            Examples
          </h2>
          <Link
            href="/examples"
            className="inline-flex shrink-0 items-center gap-1 rounded-full text-label-large text-md-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
          >
            Browse all examples
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <p className="mb-5 mt-1 text-body-medium text-md-on-surface-variant">
          Working agents you can try now. No account needed.
        </p>
        <AgentGrid agents={examples} limit={4} showControls={false} />
      </section>
    </>
  );
}
