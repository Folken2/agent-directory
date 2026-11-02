import type { Metadata } from 'next';
import AgentGrid from '@/components/AgentGrid';
import BuildCta from '@/components/story/BuildCta';
import { Page, PageHeader } from '@/components/layout/Page';
import { loadExampleAgents } from '@/lib/agent-catalog';
import { examplesJsonLd, jsonLdScript, siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Example agents | ADK Agent Directory',
  description:
    "Working example agents built with Google's Agent Development Kit (ADK). Try them free in the browser. Independent project, not affiliated with Google.",
  alternates: { canonical: '/examples' },
};

export default function ExamplesPage() {
  const agents = loadExampleAgents();
  return (
    <Page>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(examplesJsonLd(agents, siteUrl())) }}
      />
      <PageHeader
        title="Examples"
        description="Working agents built with the Agent Development Kit. Open one to see how it is put together, then try it in chat."
      />
      <AgentGrid agents={agents} />
      <BuildCta title="Don't see what you need?" body="Describe your own agent and the builder will design it with you." />
    </Page>
  );
}
