import type { Metadata } from 'next';
import Link from 'next/link';
import { NOT_AFFILIATED_NOTICE } from '@/lib/site';
import { Page, PageHeader, Section } from '@/components/layout/Page';
import { proseLink } from '@/components/ProsePage';
import HowItWorks from '@/components/story/HowItWorks';
import BuildCta from '@/components/story/BuildCta';

const REPO_URL = 'https://github.com/Folken2/agent-directory';
const ADK_URL = 'https://google.github.io/adk-docs/';

export const metadata: Metadata = {
  title: 'About | ADK Agent Directory',
  description:
    "An agent builder and working example agents built with Google's Agent Development Kit (ADK). Independent open-source project, not affiliated with Google.",
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <Page>
      <PageHeader
        title="About"
        description="Agent Directory helps you go from an idea to an agent design you can build, and shows working examples built with Google's Agent Development Kit (ADK)."
      />

      <Section title="How it works">
        <HowItWorks />
      </Section>

      <div className="mt-16 grid gap-12 text-body-large text-md-on-surface-variant md:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-headline-small tracking-tight text-md-on-surface">Learn from examples</h2>
          <p>
            The <Link href="/examples" className={proseLink}>examples</Link> are complete agents you can try in
            the browser without an account: web research, data analysis, image generation, diagrams, repository
            exploration and more. Each page lists the tools it uses and links to its source.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-headline-small tracking-tight text-md-on-surface">Built with ADK, in the open</h2>
          <p>
            Every agent runs on the{' '}
            <a href={ADK_URL} target="_blank" rel="noreferrer" className={proseLink}>Agent Development Kit</a>,
            an open-source framework for agents with tools, sub-agents and session state. The site and the
            examples are open source on{' '}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={proseLink}>GitHub</a>; contributions are
            welcome.
          </p>
        </section>
      </div>

      <p className="mt-16 max-w-3xl border-t border-md-outline/60 pt-6 text-body-medium text-md-on-surface-variant">
        {NOT_AFFILIATED_NOTICE}
      </p>

      <BuildCta />
    </Page>
  );
}
