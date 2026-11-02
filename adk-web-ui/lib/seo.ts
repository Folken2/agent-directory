/**
 * Shared SEO helpers: canonical site URL, sitemap entries and JSON-LD.
 *
 * Pure functions over catalog agents so the sitemap and the agent pages
 * list exactly the same URLs (both read the offline catalog).
 */

import type { MetadataRoute } from 'next';
import type { CatalogAgent } from './agent-catalog';

export const SITE_NAME = 'ADK Agent Directory';
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
export function buildSitemap(agents: CatalogAgent[], baseUrl: string): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/examples`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.6 },
  ];

  const agentPages: MetadataRoute.Sitemap = agents.map((agent) => {
    const lastModified = parseDate(agent.lastUpdated);
    return {
      url: `${baseUrl}${agentPath(agent.name)}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: 'monthly',
      priority: 0.8,
    };
  });

  return [...staticPages, ...agentPages];
}

type Crumb = { label: string; href: string };

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
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: baseUrl },
      { '@type': 'ListItem', position: 2, name: parent.label, item: `${baseUrl}${parent.href === '/' ? '' : parent.href}` },
      { '@type': 'ListItem', position: 3, name: displayName, item: url },
    ],
  };
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

/** Serialize JSON-LD for a <script> tag; escapes `<` so content can't close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
