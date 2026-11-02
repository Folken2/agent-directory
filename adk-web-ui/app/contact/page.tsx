import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { panelClass } from '@/components/ui/card';
import { Page, PageHeader, Section } from '@/components/layout/Page';
import { proseLink } from '@/components/ProsePage';
import BuildCta from '@/components/story/BuildCta';
import { contactEmail, profileLinks } from '@/lib/site';
import { contactJsonLd, jsonLdScript, SITE_NAME, SITE_OWNER, siteUrl } from '@/lib/seo';

const REPO_ISSUES_URL = 'https://github.com/Folken2/agent-directory/issues';

export const metadata: Metadata = {
  title: `Contact ${SITE_OWNER} | ${SITE_NAME}`,
  description: `Get in touch with ${SITE_OWNER}, who builds the ADK Agent Directory, for consulting on Google ADK agents: design reviews, MCP integrations and taking agents to production.`,
  alternates: { canonical: '/contact' },
};

const services = [
  {
    title: 'Take an agent to production',
    body: 'Deployment, sessions and memory, rate limits, observability, evaluation and guardrails for an ADK agent that works on your laptop but is not ready for users yet.',
  },
  {
    title: 'Connect your tools and data',
    body: 'MCP servers, function tools and APIs wired into ADK with the right auth, so the agent can act on your systems safely.',
  },
  {
    title: 'Design and code review',
    body: 'A second pair of eyes on your agent architecture: when to use sub-agents or workflow agents, prompts, tool design and cost.',
  },
];

export default function ContactPage() {
  const email = contactEmail();
  const profiles = profileLinks();

  return (
    <Page>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(contactJsonLd(siteUrl(), profiles.map((link) => link.href))),
        }}
      />
      <PageHeader
        title="Contact"
        description={`I'm ${SITE_OWNER}. I build this directory and help teams design Google ADK agents and take them to production. If you are building an agent and want help, get in touch.`}
      />

      <div className={cn(panelClass, 'p-6 sm:p-8')}>
        <h2 className="text-headline-small tracking-tight text-md-on-surface">Get in touch</h2>
        <p className="mt-2 max-w-2xl text-body-large text-md-on-surface-variant">
          Tell me what you are building, where it runs today and what is in the way.
        </p>
        {email || profiles.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {email ? (
              <a
                href={`mailto:${email}`}
                data-ga-event="contact_email"
                className={buttonVariants({ variant: 'filled' })}
              >
                <Mail />
                Email me
              </a>
            ) : null}
            {profiles.map((link, i) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                data-ga-event={`contact_${link.label.toLowerCase()}`}
                className={buttonVariants({ variant: !email && i === 0 ? 'filled' : 'outlined' })}
              >
                {link.label}
                <ArrowUpRight />
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-body-large text-md-on-surface-variant">
            Open an issue on{' '}
            <a href={REPO_ISSUES_URL} target="_blank" rel="noreferrer" className={proseLink}>GitHub</a>{' '}
            and I&apos;ll get back to you.
          </p>
        )}
      </div>

      <Section title="How I can help">
        <ul className="grid gap-x-10 gap-y-6 md:grid-cols-3">
          {services.map((service) => (
            <li key={service.title}>
              <h3 className="text-title-medium text-md-on-surface">{service.title}</h3>
              <p className="mt-1 text-body-medium text-md-on-surface-variant">{service.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Before you write">
        <div className="max-w-3xl space-y-3 text-body-large text-md-on-surface-variant">
          <p>
            The <Link href="/guides" className={proseLink}>guides</Link> show common ADK patterns with working code,
            and every <Link href="/examples" className={proseLink}>example agent</Link> can be tried in the browser.
            Found a bug or have a question about the site itself? Open an{' '}
            <a href={REPO_ISSUES_URL} target="_blank" rel="noreferrer" className={proseLink}>issue on GitHub</a>.
          </p>
        </div>
      </Section>

      <BuildCta />
    </Page>
  );
}
