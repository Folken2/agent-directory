import type { Metadata } from 'next';
import Link from 'next/link';
import { NOT_AFFILIATED_NOTICE } from '@/lib/site';
import { ProsePage, ProseSection, proseLink } from '@/components/ProsePage';

const REPO_URL = 'https://github.com/Folken2/agent-directory';

export const metadata: Metadata = {
  title: 'About | ADK Agent Directory',
  description:
    "An agent builder and working example agents built with Google's Agent Development Kit (ADK). Independent open-source project, not affiliated with Google.",
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <ProsePage
      title="About"
      lead="Agent Directory helps you design an AI agent and shows working examples built with Google's Agent Development Kit (ADK)."
    >
      <ProseSection title="How it works">
        <p>
          Describe the agent you have in mind on the{' '}
          <Link href="/" className={proseLink}>Build</Link> page. The agent builder asks about your goal, then
          proposes a design: which agents to use and how they work together, the tools and data they need, and
          code to get started. The design collects in a blueprint you can copy, download or save.
        </p>
        <p>
          The <Link href="/examples" className={proseLink}>examples</Link> show what finished agents look like:
          web research, data analysis, image generation, diagrams, repository exploration and more. You can try
          each one in the browser without an account.
        </p>
      </ProseSection>

      <ProseSection title="Built with ADK">
        <p>
          Every agent here runs on the Agent Development Kit, an open-source framework for building agents with
          tools, sub-agents and session state. Gemini models are the default.
        </p>
      </ProseSection>

      <ProseSection title="Open source">
        <p>
          The site and every example agent are open source. Read how they are built, reuse the patterns, or
          contribute a new example on{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={proseLink}>GitHub</a>.
        </p>
      </ProseSection>

      <p className="border-t border-md-outline/60 pt-6 text-body-medium">{NOT_AFFILIATED_NOTICE}</p>
    </ProsePage>
  );
}
