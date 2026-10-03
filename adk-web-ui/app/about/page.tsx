import type { Metadata } from 'next';
import Link from 'next/link';
import { NOT_AFFILIATED_NOTICE } from '@/lib/site';
import { Page, PageHeader } from '@/components/layout/Page';
import { proseLink } from '@/components/ProsePage';
import BuildCta from '@/components/story/BuildCta';

const REPO_URL = 'https://github.com/Folken2/agent-directory';
const ADK_URL = 'https://google.github.io/adk-docs/';
const NUVEL_URL = 'https://github.com/Folken2/nuvel';

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
        description="Agent Directory helps you go from an idea to a working agent, and shows examples built with Google's Agent Development Kit (ADK)."
      />

      <div className="grid gap-12 text-body-large text-md-on-surface-variant lg:grid-cols-3">
        <section className="space-y-3">
          <h2 className="text-headline-small tracking-tight text-md-on-surface">Build with the builder</h2>
          <p>
            Describe the agent you have in mind on the <Link href="/" className={proseLink}>Build</Link> page.
            The agent builder asks about your goal, then proposes the agents, tools and prompts, and explains
            why. The design collects in a blueprint you can copy, download or save. When you agree, it builds
            the agent on{' '}
            <a href={NUVEL_URL} target="_blank" rel="noreferrer" className={proseLink}>nuvel</a>
            {' '}and hands you a zip: server, plugins, guardrails, Dockerfile and tests included.
          </p>
        </section>
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
