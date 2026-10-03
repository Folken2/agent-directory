import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight, MessageSquare } from 'lucide-react';
import { getCatalogAgent, loadExampleAgents, loadOfflineCatalog } from '@/lib/agent-catalog';
import { BUILDER_AGENT, builderChatHref } from '@/lib/builder';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { panelClass } from '@/components/ui/card';
import { Page, PageHeader, Section } from '@/components/layout/Page';
import AgentActions from '@/components/agent/AgentActions';
import AgentLogo from '@/components/agent/AgentLogo';
import AgentGrid from '@/components/AgentGrid';
import BuildCta from '@/components/story/BuildCta';

type Params = Promise<{ name: string }>;

// Every agent ships its metadata.json with the site, so unknown names are a plain 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return loadOfflineCatalog().map((agent) => ({ name: agent.name }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { name } = await params;
  const agent = getCatalogAgent(decodeURIComponent(name));
  if (!agent) return { title: 'Agent not found | ADK Agent Directory' };

  const title = `${agent.displayName} | ADK Agent Directory`;
  const url = `/agents/${encodeURIComponent(agent.name)}`;
  return {
    title,
    description: agent.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      siteName: 'ADK Agent Directory',
      title,
      description: agent.description,
    },
    twitter: { card: 'summary_large_image', title, description: agent.description },
  };
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <dt className="text-label-large text-md-on-surface-variant">{label}</dt>
      <dd className="mt-1.5 text-body-medium text-md-on-surface">{children}</dd>
    </div>
  );
}

const externalLink =
  'inline-flex items-center gap-1 text-md-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary rounded-sm';

/** Other examples, same category first. */
function relatedAgents(current: string, category: string | undefined) {
  const others = loadExampleAgents().filter((a) => a.name !== current);
  return [...others.filter((a) => a.category === category), ...others.filter((a) => a.category !== category)];
}

export default async function AgentDetailPage({ params }: { params: Params }) {
  const { name } = await params;
  const agent = getCatalogAgent(decodeURIComponent(name));
  if (!agent) notFound();

  const displayName = agent.displayName || agent.name;
  const chatHref = `/chat?agent=${encodeURIComponent(agent.name)}`;
  const isBuilder = agent.name === BUILDER_AGENT;
  const parent = isBuilder ? { label: 'Build', href: '/' } : { label: 'Examples', href: '/examples' };
  const byline = [agent.category, agent.author ? `by ${agent.author}` : null].filter(Boolean).join(' · ');
  const tools = agent.tools ?? [];
  const tags = agent.tags ?? [];
  const useCases = agent.useCases ?? [];
  const prompts = agent.samplePrompts ?? [];
  const related = isBuilder ? [] : relatedAgents(agent.name, agent.category);
  const adaptHref = builderChatHref(
    `Design an agent like ${displayName} (${agent.description}) for my use case: `,
    { autoSend: false }
  );

  return (
    <Page>
      <PageHeader
        breadcrumbs={[parent, { label: displayName }]}
        leading={<AgentLogo src={agent.logo} name={displayName} size="lg" className="mt-1" />}
        title={displayName}
        description={
          <>
            {byline ? <p className="text-body-medium">{byline}</p> : null}
            <p className="mt-3">{agent.description}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href={chatHref} className={buttonVariants({ variant: 'filled' })}>
                <MessageSquare />
                Try it in chat
              </Link>
              <AgentActions name={agent.name} displayName={displayName} description={agent.description} />
            </div>
          </>
        }
      />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="[&>section:first-child]:mt-0">
          {useCases.length > 0 ? (
            <Section title="What it's good at">
              <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                {useCases.map((useCase) => (
                  <div key={useCase.title}>
                    <dt className="text-title-medium text-md-on-surface">{useCase.title}</dt>
                    <dd className="mt-1 text-body-medium text-md-on-surface-variant">{useCase.description}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          ) : null}

          {prompts.length > 0 ? (
            <Section title="Try a prompt" description="Opens a chat with the prompt ready to send.">
              <ul className={cn(panelClass, 'divide-y divide-md-outline/60 overflow-hidden dark:divide-md-outline-variant')}>
                {prompts.map((prompt) => (
                  <li key={prompt}>
                    <Link
                      href={`${chatHref}&prompt=${encodeURIComponent(prompt)}`}
                      className="group flex items-start gap-4 px-5 py-4 text-body-medium text-md-on-surface transition-colors hover:bg-md-on-surface/4 focus-visible:bg-md-on-surface/8 focus-visible:outline-none"
                    >
                      <span className="flex-1">{prompt}</span>
                      <ArrowUpRight
                        className="mt-0.5 size-4 shrink-0 text-md-on-surface-variant transition-colors group-hover:text-md-primary"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside aria-label="Details" className="lg:pt-0">
          <div className={cn(panelClass, 'p-5 lg:sticky lg:top-24')}>
            <h2 className="mb-4 text-title-medium text-md-on-surface">Details</h2>
            <dl className="divide-y divide-md-outline/60 dark:divide-md-outline-variant">
              {tools.length > 0 ? (
                <DetailBlock label="Tools">
                  <ul className="flex flex-wrap gap-1.5">
                    {tools.map((tool) => (
                      <li key={tool}>
                        <code className="rounded-[var(--md-shape-sm)] bg-md-surface-container px-2 py-0.5 font-mono text-[13px] dark:bg-md-surface-container-high">
                          {tool}
                        </code>
                      </li>
                    ))}
                  </ul>
                </DetailBlock>
              ) : null}
              {tags.length > 0 ? <DetailBlock label="Tags">{tags.join(', ')}</DetailBlock> : null}
              {agent.githubUrl ? (
                <DetailBlock label="Source">
                  <a href={agent.githubUrl} target="_blank" rel="noreferrer" className={externalLink}>
                    View on GitHub
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                </DetailBlock>
              ) : null}
              {agent.documentation ? (
                <DetailBlock label="Documentation">
                  <a href={agent.documentation} target="_blank" rel="noreferrer" className={externalLink}>
                    Read the docs
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </a>
                </DetailBlock>
              ) : null}
              {agent.version ? <DetailBlock label="Version">{agent.version}</DetailBlock> : null}
              {agent.lastUpdated ? (
                <DetailBlock label="Updated">
                  {new Date(agent.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </DetailBlock>
              ) : null}
              <DetailBlock label="Framework">Agent Development Kit</DetailBlock>
            </dl>
          </div>
        </aside>
      </div>

      {isBuilder ? (
        <BuildCta />
      ) : (
        <>
          <BuildCta
            title="Want one like this for your case?"
            body="Start from this example in the builder and adapt it to your own data, tools and workflow."
          >
            <Link href={adaptHref} className={buttonVariants({ variant: 'filled' })}>
              Adapt this agent in the builder
              <ArrowRight />
            </Link>
          </BuildCta>
          {related.length > 0 ? (
            <Section title="More examples" className="mt-20">
              <AgentGrid agents={related} limit={4} showControls={false} />
            </Section>
          ) : null}
        </>
      )}
    </Page>
  );
}
