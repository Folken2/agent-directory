import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, MessageSquare } from 'lucide-react';
import { getCatalogAgent, loadOfflineCatalog } from '@/lib/agent-catalog';
import { BUILDER_AGENT } from '@/lib/builder';
import { buttonVariants } from '@/components/ui/button';
import AgentActions from '@/components/agent/AgentActions';
import AgentLogo from '@/components/agent/AgentLogo';

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="text-title-large tracking-tight text-md-on-surface">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3.5 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="text-label-large text-md-on-surface-variant">{label}</dt>
      <dd className="text-body-medium text-md-on-surface">{children}</dd>
    </div>
  );
}

const externalLink =
  'inline-flex items-center gap-1 text-md-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary rounded-sm';

export default async function AgentDetailPage({ params }: { params: Params }) {
  const { name } = await params;
  const agent = getCatalogAgent(decodeURIComponent(name));
  if (!agent) notFound();

  const displayName = agent.displayName || agent.name;
  const chatHref = `/chat?agent=${encodeURIComponent(agent.name)}`;
  const isBuilder = agent.name === BUILDER_AGENT;
  const back = isBuilder ? { href: '/', label: 'Build' } : { href: '/examples', label: 'Examples' };
  const byline = [agent.category, agent.author ? `by ${agent.author}` : null].filter(Boolean).join(' · ');
  const tools = agent.tools ?? [];
  const tags = agent.tags ?? [];
  const useCases = agent.useCases ?? [];
  const prompts = agent.samplePrompts ?? [];
  const hasDetails =
    tools.length > 0 || tags.length > 0 || Boolean(agent.githubUrl || agent.documentation || agent.version || agent.lastUpdated);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <Link
        href={back.href}
        className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 text-label-large text-md-on-surface-variant transition-colors hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {back.label}
      </Link>

      <header className="mt-8 flex items-start gap-4">
        <AgentLogo src={agent.logo} name={displayName} size="lg" />
        <div className="min-w-0">
          <h1 className="text-headline-large tracking-tight text-md-on-surface">{displayName}</h1>
          {byline ? <p className="mt-1 text-body-medium text-md-on-surface-variant">{byline}</p> : null}
        </div>
      </header>

      <p className="mt-6 text-body-large text-md-on-surface-variant">{agent.description}</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={chatHref} className={buttonVariants({ variant: 'filled' })}>
          <MessageSquare />
          Start chat
        </Link>
        <AgentActions name={agent.name} displayName={displayName} description={agent.description} />
      </div>

      {useCases.length > 0 ? (
        <Section title="What it's good at">
          <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {useCases.map((useCase) => (
              <div key={useCase.title}>
                <dt className="text-title-small text-md-on-surface">{useCase.title}</dt>
                <dd className="mt-1 text-body-medium text-md-on-surface-variant">{useCase.description}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {prompts.length > 0 ? (
        <Section title="Try a prompt">
          <ul className="divide-y divide-md-outline/60 overflow-hidden rounded-[var(--md-shape-lg)] border border-md-outline/70 bg-md-surface">
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

      {hasDetails ? (
        <Section title="Details">
          <dl className="divide-y divide-md-outline/60 border-y border-md-outline/60">
            {tools.length > 0 ? (
              <DetailRow label="Tools">
                <ul className="flex flex-wrap gap-1.5">
                  {tools.map((tool) => (
                    <li key={tool}>
                      <code className="rounded-[var(--md-shape-sm)] bg-md-surface-container px-2 py-0.5 font-mono text-[13px]">
                        {tool}
                      </code>
                    </li>
                  ))}
                </ul>
              </DetailRow>
            ) : null}
            {tags.length > 0 ? <DetailRow label="Tags">{tags.join(', ')}</DetailRow> : null}
            {agent.githubUrl ? (
              <DetailRow label="Source">
                <a href={agent.githubUrl} target="_blank" rel="noreferrer" className={externalLink}>
                  GitHub
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </DetailRow>
            ) : null}
            {agent.documentation ? (
              <DetailRow label="Documentation">
                <a href={agent.documentation} target="_blank" rel="noreferrer" className={externalLink}>
                  Read the docs
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </DetailRow>
            ) : null}
            {agent.version ? <DetailRow label="Version">{agent.version}</DetailRow> : null}
            {agent.lastUpdated ? (
              <DetailRow label="Updated">
                {new Date(agent.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </DetailRow>
            ) : null}
          </dl>
        </Section>
      ) : null}
    </div>
  );
}
