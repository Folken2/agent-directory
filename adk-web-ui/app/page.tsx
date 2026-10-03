import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import AgentGrid from '@/components/AgentGrid';
import DirectoryPulse from '@/components/analytics/DirectoryPulse';
import BuilderHero from '@/components/home/BuilderHero';
import { buttonVariants } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-md-surface">
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 flex justify-center">
            <DirectoryPulse />
          </div>
          <h1 className="mb-4 text-display-small tracking-tight text-md-on-surface sm:text-display-medium">
            What agent do you want to build?
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-body-large text-md-on-surface-variant">
            Describe it in a sentence. The agent builder helps you design it with Google&apos;s Agent
            Development Kit: architecture, tools, prompts and code.
          </p>
        </div>
        <BuilderHero />
      </section>

      <section
        id="examples"
        aria-labelledby="examples-heading"
        className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="examples-heading" className="text-headline-small tracking-tight text-md-on-surface">
              Examples
            </h2>
            <p className="mt-1 text-body-medium text-md-on-surface-variant">
              Working agents you can try right now, free and without an account.
            </p>
          </div>
          <Link href="/examples" className={buttonVariants({ variant: 'text' })}>
            Browse all examples
            <ArrowRight />
          </Link>
        </div>
        <AgentGrid limit={4} showControls={false} />
      </section>
    </div>
  );
}
