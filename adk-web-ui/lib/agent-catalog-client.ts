/**
 * Client-safe agent display lookup from the committed catalog snapshot.
 * Avoids waiting on `/api/agents` / ADK cold start just to show logos.
 */

import snapshotJson from './agent-catalog.snapshot.json';
import { formatAgentDisplayName } from './agent-utils';
import type { Agent } from './types';

type SnapshotAgent = {
  name: string;
  displayName?: string;
  description?: string;
  tools?: string[];
  tags?: string[];
  useCases?: Array<{ title: string; description: string }>;
  samplePrompts?: string[];
  author?: string;
  logo?: string;
  category?: string;
  githubUrl?: string;
};

const snapshot = snapshotJson as {
  agents: Array<string | SnapshotAgent>;
};

const REPO_BASE = (process.env.NEXT_PUBLIC_AGENTS_REPO_URL || 'https://github.com/Folken2/agent-directory').replace(
  /\/$/,
  ''
);

let cachedMap: Map<string, Agent> | null = null;

function buildMap(): Map<string, Agent> {
  const map = new Map<string, Agent>();
  for (const entry of snapshot.agents ?? []) {
    if (typeof entry === 'string') {
      map.set(entry, {
        name: entry,
        displayName: formatAgentDisplayName(entry),
        description: '',
      });
      continue;
    }
    map.set(entry.name, {
      name: entry.name,
      displayName: entry.displayName || formatAgentDisplayName(entry.name),
      description: entry.description || '',
      tools: entry.tools ?? [],
      tags: entry.tags ?? [],
      useCases: entry.useCases ?? [],
      samplePrompts: entry.samplePrompts ?? [],
      author: entry.author,
      logo: entry.logo,
      category: entry.category,
      // Same default as lib/agent-metadata.ts, so the chat's "View on GitHub" matches /api/agents.
      githubUrl: entry.githubUrl || `${REPO_BASE}/tree/main/agents/${entry.name}`,
    });
  }
  return map;
}

/** Sync map of slug → agent from the bundled snapshot. */
export function getCatalogAgentMap(): Map<string, Agent> {
  if (!cachedMap) cachedMap = buildMap();
  return cachedMap;
}

/** All agent slugs in the bundled catalog snapshot. */
export function listCatalogAgentSlugs(): string[] {
  return [...getCatalogAgentMap().keys()].sort();
}

/** The agent as the snapshot knows it, or null when the slug isn't in the catalog. */
export function findCatalogAgent(slug: string): Agent | null {
  return getCatalogAgentMap().get(slug) ?? null;
}

export function getCatalogAgent(slug: string): Agent {
  const hit = findCatalogAgent(slug);
  if (hit) return hit;
  return {
    name: slug,
    displayName: formatAgentDisplayName(slug),
    description: '',
  };
}
