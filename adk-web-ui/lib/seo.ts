/**
 * Shared SEO helpers: canonical site URL, sitemap entries and JSON-LD.
 *
 * Pure functions over catalog agents so the sitemap and the agent pages
 * list exactly the same URLs (both read the offline catalog).
 */

import type { MetadataRoute } from 'next';
import type { CatalogAgent } from './agent-catalog';
import { guideMarkdownPath, guidePath, type GuideMeta } from './guides';

export const SITE_NAME = 'ADK Agent Directory';
/** Author of the guides and the person behind /contact. */
export const SITE_OWNER = 'Albert Folch';
const DEFAULT_SITE_URL = 'https://agentdirectory.folch.ai';

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function agentPath(name: string): string {
  return `/agents/${encodeURIComponent(name)}`;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Indexable pages only. /chat is an app shell with no rankable content, and
 * lastModified is left out unless we actually know it — a date that changes
 * on every build teaches Google to ignore it.
 */
export function buildSitemap(
  agents: CatalogAgent[],
  baseUrl: string,
  guides: GuideMeta[] = []
): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/examples`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/guides`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`, changeFrequency: 'yearly', priority: 0.5 },
  ];

  const guidePages: MetadataRoute.Sitemap = guides.map((guide) => {
    const lastModified = parseDate(guide.updated ?? guide.published);
    return {
      url: `${baseUrl}${guidePath(guide.slug)}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: 'monthly',
      priority: 0.85,
    };
  });

  const agentPages: MetadataRoute.Sitemap = agents.map((agent) => {
    const lastModified = parseDate(agent.lastUpdated);
    return {
      url: `${baseUrl}${agentPath(agent.name)}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: 'monthly',
      priority: 0.8,
    };
  });

  return [...staticPages, ...guidePages, ...agentPages];
}

type Crumb = { label: string; href: string };

function breadcrumbList(baseUrl: string, trail: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ label: SITE_NAME, href: '/' }, ...trail].map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: `${baseUrl}${crumb.href === '/' ? '' : crumb.href}`,
    })),
  };
}

/** JSON-LD for an agent detail page: the agent as an app plus its breadcrumb trail. */
export function agentJsonLd(agent: CatalogAgent, baseUrl: string, parent: Crumb) {
  const url = `${baseUrl}${agentPath(agent.name)}`;
  const displayName = agent.displayName || agent.name;
  const lastModified = parseDate(agent.lastUpdated);

  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: displayName,
    description: agent.description,
    url,
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: agent.category,
    operatingSystem: 'Web',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(agent.author ? { author: { '@type': 'Person', name: agent.author } } : {}),
    ...(agent.tags?.length ? { keywords: agent.tags.join(', ') } : {}),
    ...(agent.githubUrl ? { codeRepository: agent.githubUrl } : {}),
    ...(agent.version ? { softwareVersion: agent.version } : {}),
    ...(lastModified ? { dateModified: lastModified.toISOString() } : {}),
  };
  const breadcrumbs = breadcrumbList(baseUrl, [parent, { label: displayName, href: agentPath(agent.name) }]);
  return [app, breadcrumbs] as const;
}

/** JSON-LD ItemList for the examples index, so each agent is discoverable from it. */
export function examplesJsonLd(agents: Array<{ name: string; displayName?: string }>, baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Example agents',
    itemListElement: agents.map((agent, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: agent.displayName || agent.name,
      url: `${baseUrl}${agentPath(agent.name)}`,
    })),
  };
}

/** JSON-LD for a guide: a TechArticle that mentions its example agents, plus its breadcrumb trail. */
export function guideJsonLd(guide: GuideMeta, baseUrl: string) {
  const url = `${baseUrl}${guidePath(guide.slug)}`;
  const author = { '@type': 'Person', name: SITE_OWNER, url: `${baseUrl}/contact` };
  const article = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: guide.title,
    description: guide.description,
    url,
    mainEntityOfPage: url,
    datePublished: guide.published,
    dateModified: guide.updated ?? guide.published,
    author,
    publisher: author,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: baseUrl },
    ...(guide.keywords.length ? { keywords: guide.keywords.join(', ') } : {}),
    ...(guide.agents.length
      ? {
          mentions: guide.agents.map((name) => ({
            '@type': 'SoftwareApplication',
            name,
            url: `${baseUrl}${agentPath(name)}`,
          })),
        }
      : {}),
  };
  const breadcrumbs = breadcrumbList(baseUrl, [
    { label: 'Guides', href: '/guides' },
    { label: guide.title, href: guidePath(guide.slug) },
  ]);
  return [article, breadcrumbs] as const;
}

/** JSON-LD for /contact: the page, about the person to contact. */
export function contactJsonLd(baseUrl: string, sameAs: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `Contact ${SITE_OWNER}`,
    url: `${baseUrl}/contact`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: baseUrl },
    mainEntity: {
      '@type': 'Person',
      name: SITE_OWNER,
      jobTitle: 'AI agent consultant',
      knowsAbout: ['Google Agent Development Kit', 'AI agents', 'Model Context Protocol'],
      ...(sameAs.length ? { sameAs } : {}),
    },
  };
}

/**
 * /llms.txt (llmstxt.org): a Markdown map of the site for coding agents.
 * Guides link to their .md copies, which agents can fetch as plain text.
 */
export function buildLlmsTxt(
  agents: Array<{ name: string; displayName?: string; description?: string }>,
  guides: GuideMeta[],
  baseUrl: string
): string {
  const oneLine = (text = '') => text.replace(/\s+/g, ' ').trim();
  const item = (label: string, url: string, note?: string) =>
    `- [${label}](${url})${note ? `: ${oneLine(note)}` : ''}`;
  return [
    `# ${SITE_NAME}`,
    "> Working example agents built with Google's Agent Development Kit (ADK), how-to guides that explain them, and an agent builder. Independent open-source project, not affiliated with Google.",
    [
      '## Guides',
      ...guides.map((guide) => item(guide.title, `${baseUrl}${guideMarkdownPath(guide.slug)}`, guide.description)),
    ].join('\n'),
    [
      '## Example agents',
      ...agents.map((agent) => item(agent.displayName || agent.name, `${baseUrl}${agentPath(agent.name)}`, agent.description)),
    ].join('\n'),
    [
      '## Optional',
      item('Agent builder', `${baseUrl}/`, 'Describe an agent and get a runnable ADK project'),
      item('Chat with an agent', `${baseUrl}/chat?agent=<name>`, 'Opens any example agent above by its name; no account needed'),
      item('Agent catalog (JSON)', `${baseUrl}/api/agents`, 'Every agent with its description, tools, tags and sample prompts'),
      item('About', `${baseUrl}/about`),
      item('Contact', `${baseUrl}/contact`, `${SITE_OWNER}, consulting on ADK agents in production`),
    ].join('\n'),
  ].join('\n\n') + '\n';
}

/** Serialize JSON-LD for a <script> tag; escapes `<` so content can't close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
