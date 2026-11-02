/**
 * How-to guides, one Markdown file per guide in content/guides/<slug>.md.
 *
 * Adding a guide is adding a file: the index, the guide page, the sitemap
 * and the "Learn how it's built" links on agent pages all read this loader.
 * Pages are prerendered, so the files are only read at build time.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export type GuideMeta = {
  slug: string;
  /** The page heading. */
  title: string;
  /** The <title> tag, used as-is: keep it under ~60 characters. */
  seoTitle: string;
  description: string;
  /** ISO dates (YYYY-MM-DD). */
  published: string;
  updated?: string;
  /** Example agents that demonstrate the guide, by catalog name. The first is the main one. */
  agents: string[];
  keywords: string[];
};

export type Guide = GuideMeta & { body: string };

export type GuideHeading = { id: string; text: string };

const REQUIRED = ['title', 'seoTitle', 'description', 'published'] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function guidesDir(cwd: string = process.cwd()): string {
  return join(cwd, 'content', 'guides');
}

/**
 * Parse `---` frontmatter of flat `key: value` lines. List fields (agents,
 * keywords) are comma-separated. Throws on a malformed guide so a bad file
 * fails the build instead of shipping a broken page.
 */
export function parseGuide(slug: string, source: string): Guide {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Guide "${slug}" has no frontmatter`);

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(':');
    if (colon === -1) throw new Error(`Guide "${slug}": bad frontmatter line "${line}"`);
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }

  for (const key of REQUIRED) {
    if (!fields[key]) throw new Error(`Guide "${slug}" is missing "${key}"`);
  }
  for (const key of ['published', 'updated'] as const) {
    if (fields[key] && !DATE.test(fields[key])) throw new Error(`Guide "${slug}": ${key} must be YYYY-MM-DD`);
  }

  const list = (value: string | undefined) =>
    (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

  return {
    slug,
    title: fields.title,
    seoTitle: fields.seoTitle,
    description: fields.description,
    published: fields.published,
    ...(fields.updated ? { updated: fields.updated } : {}),
    agents: list(fields.agents),
    keywords: list(fields.keywords),
    body: match[2].trim(),
  };
}

/** All guides, newest first. */
export function loadGuides(dir: string = guidesDir()): Guide[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => parseGuide(file.replace(/\.md$/, ''), readFileSync(join(dir, file), 'utf8')))
    .sort((a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug));
}

export function getGuide(slug: string): Guide | undefined {
  return loadGuides().find((guide) => guide.slug === slug);
}

/** Guides that use this agent as an example, for the agent page's back link. */
export function guidesForAgent(agentName: string, guides: Guide[] = loadGuides()): GuideMeta[] {
  return guides
    .filter((guide) => guide.agents.includes(agentName))
    .map((guide) => {
      const meta: GuideMeta & { body?: string } = { ...guide };
      delete meta.body;
      return meta;
    });
}

export function guidePath(slug: string): string {
  return `/guides/${encodeURIComponent(slug)}`;
}

export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The `## ` headings, for the "On this page" list. Ignores lines inside code fences. */
export function guideHeadings(body: string): GuideHeading[] {
  const headings: GuideHeading[] = [];
  let inFence = false;
  for (const line of body.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    else if (!inFence && line.startsWith('## ')) {
      const text = line.slice(3).trim();
      headings.push({ id: headingId(text), text: text.replace(/`/g, '') });
    }
  }
  return headings;
}

/**
 * Rewrite root-relative Markdown links (`](/agents/x)`) and in-page anchors
 * (`](#step)`) to absolute URLs, so the text still works pasted elsewhere.
 * Code fences are left alone.
 */
export function absolutizeLinks(markdown: string, baseUrl: string, pagePath: string): string {
  let inFence = false;
  return markdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('```')) inFence = !inFence;
      if (inFence || line.startsWith('```')) return line;
      return line
        .replace(/\]\(\/(?!\/)/g, `](${baseUrl}/`)
        .replace(/\]\(#/g, `](${baseUrl}${pagePath}#`);
    })
    .join('\n');
}

/**
 * The guide as standalone Markdown, for the "Copy page" button and the
 * /guides/<slug>.md route: one source (the guide file), two renderings.
 */
export function guideMarkdown(guide: Guide, baseUrl: string, author: string): string {
  const path = guidePath(guide.slug);
  const dates = guide.updated && guide.updated !== guide.published
    ? `Published ${guide.published}, updated ${guide.updated}`
    : `Published ${guide.published}`;
  return [
    `# ${guide.title}`,
    `> ${guide.description}`,
    `Source: ${baseUrl}${path}  \nBy ${author}. ${dates}.`,
    absolutizeLinks(guide.body, baseUrl, path),
  ].join('\n\n') + '\n';
}

export function guideMarkdownPath(slug: string): string {
  return `${guidePath(slug)}.md`;
}
