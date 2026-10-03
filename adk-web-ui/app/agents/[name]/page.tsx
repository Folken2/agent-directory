import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  MessageSquare,
  Wrench,
  Tag,
  Sparkles,
  ExternalLink,
  Github,
  FileText,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react';
import { getCatalogAgent, loadOfflineCatalog } from '@/lib/agent-catalog';
import { BUILDER_AGENT } from '@/lib/builder';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import AgentActions from '@/components/agent/AgentActions';

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

export default async function AgentDetailPage({ params }: { params: Params }) {
  const { name } = await params;
  const agent = getCatalogAgent(decodeURIComponent(name));
  if (!agent) notFound();

  const displayName = agent.displayName || agent.name;
  const chatHref = `/chat?agent=${encodeURIComponent(agent.name)}`;
  const isBuilder = agent.name === BUILDER_AGENT;
  const back = isBuilder ? { href: '/', label: 'Back to Build' } : { href: '/examples', label: 'Back to Examples' };

  return (
    <div className="min-h-screen bg-gradient-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href={back.href}
          className="inline-flex items-center gap-2 text-md-on-surface-variant hover:text-md-on-surface mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {back.label}
        </Link>

        {/* ZONE 1: HERO */}
        <section className="mb-12">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                {agent.logo && (
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-md-surface-container border border-md-outline-variant/50 flex items-center justify-center overflow-hidden p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote favicons of varying hosts */}
                    <img src={agent.logo} alt="" className="object-contain w-full h-full" />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-bold text-md-on-surface tracking-tight">
                    {displayName}
                  </h1>
                  <div className="flex items-center gap-3 mt-1.5">
                    {agent.category && (
                      <Chip variant="category">{agent.category}</Chip>
                    )}
                    {agent.author && (
                      <span className="text-sm text-md-on-surface-variant flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {agent.author}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-lg text-md-on-surface-variant leading-relaxed mt-4">
                {agent.description}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <Link href={chatHref} className={buttonVariants({ variant: 'filled' })}>
              <MessageSquare />
              Start chat
            </Link>
            <AgentActions name={agent.name} displayName={displayName} description={agent.description} />
          </div>
        </section>

        {/* ZONE 2: STORY */}
        {agent.useCases && agent.useCases.length > 0 && (
          <Card variant="filled" className="mb-12 p-6 sm:p-8">
            <h2 className="text-sm font-semibold text-md-on-surface-variant uppercase tracking-wider mb-6">
              What this agent excels at
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {agent.useCases.map((useCase, idx) => (
                <Card key={idx} variant="outlined" className="p-5">
                  <h3 className="text-base font-semibold text-md-on-surface mb-1.5">
                    {useCase.title}
                  </h3>
                  <p className="text-sm text-md-on-surface-variant leading-relaxed">
                    {useCase.description}
                  </p>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* ZONE 3: ACTION */}
        {agent.samplePrompts && agent.samplePrompts.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-4 h-4 text-md-primary" />
              <h2 className="text-sm font-semibold text-md-on-surface-variant uppercase tracking-wider">
                Try it out
              </h2>
            </div>
            <div className="grid gap-3">
              {agent.samplePrompts.map((prompt, idx) => (
                <Link
                  key={idx}
                  href={`${chatHref}&prompt=${encodeURIComponent(prompt)}`}
                  className="group/prompt flex items-center gap-4 rounded-[var(--md-shape-lg)] border border-md-outline bg-md-surface px-5 py-4 text-left transition-shadow hover:shadow-elevation-2"
                >
                  <span className="shrink-0 text-md-primary">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-md-on-surface leading-relaxed flex-1">
                    {prompt}
                  </span>
                  <ArrowRight className="w-4 h-4 text-md-on-surface-variant opacity-0 group-hover/prompt:opacity-100 transition-opacity shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ZONE 4: METADATA FOOTER */}
        <section className="border-t border-md-outline-variant/40 pt-8 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-md-on-surface-variant">
            {/* Tools */}
            {agent.tools && agent.tools.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Wrench className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Tools</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.map((tool) => (
                    <Chip key={tool} variant="assist" className="font-mono">
                      {tool}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {agent.tags && agent.tags.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Tags</span>
                </div>
                <p className="text-sm">
                  {agent.tags.join(' · ')}
                </p>
              </div>
            )}

            {/* Links */}
            {(agent.githubUrl || agent.documentation) && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block mb-2">Links</span>
                <div className="flex flex-wrap gap-3">
                  {agent.githubUrl && (
                    <a
                      href={agent.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-md-on-surface transition-colors"
                    >
                      <Github className="w-3.5 h-3.5" />
                      GitHub
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {agent.documentation && (
                    <a
                      href={agent.documentation}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-md-on-surface transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Docs
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Version & Updated */}
            {(agent.version || agent.lastUpdated) && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider block mb-2">Info</span>
                <div className="flex items-center gap-3">
                  {agent.version && <span>v{agent.version}</span>}
                  {agent.lastUpdated && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Updated {new Date(agent.lastUpdated).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
