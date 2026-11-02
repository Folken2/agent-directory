import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { panelClass } from '@/components/ui/card';
import { Page, PageHeader } from '@/components/layout/Page';
import BuildCta from '@/components/story/BuildCta';
import { getCatalogAgent } from '@/lib/agent-catalog';
import { guidePath, loadGuides } from '@/lib/guides';
import { SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: `Google ADK guides | ${SITE_NAME}`,
  description:
    "Practical how-to guides for Google's Agent Development Kit (ADK). Each pattern is shown with real code from a live example agent you can try in the browser.",
  alternates: { canonical: '/guides' },
};

export default function GuidesPage() {
  const guides = loadGuides();
  return (
    <Page>
      <PageHeader
        title="Guides"
        description="How to build common agent patterns with the Agent Development Kit. Every guide quotes the code of a working example agent, so you can read it and then try it live."
      />
      <ul className="grid gap-4 md:grid-cols-2">
        {guides.map((guide) => {
          const agents = guide.agents.flatMap((name) => getCatalogAgent(name)?.displayName ?? []);
          return (
            <li key={guide.slug}>
              <Link
                href={guidePath(guide.slug)}
                className={cn(
                  panelClass,
                  'group flex h-full flex-col p-6 transition-shadow hover:shadow-elevation-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary'
                )}
              >
                <h2 className="text-title-large text-md-on-surface group-hover:text-md-primary">{guide.title}</h2>
                <p className="mt-2 flex-1 text-body-medium text-md-on-surface-variant">{guide.description}</p>
                {agents.length > 0 ? (
                  <p className="mt-4 text-body-small text-md-on-surface-variant">Example agents: {agents.join(', ')}</p>
                ) : null}
                <span className="mt-4 inline-flex items-center gap-1 text-label-large text-md-primary">
                  Read the guide
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <BuildCta />
    </Page>
  );
}
