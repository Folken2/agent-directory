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
  logo?: string;
  category?: string;
};

const snapshot = snapshotJson as {
  agents: Array<string | SnapshotAgent>;
};

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
      logo: entry.logo,
      category: entry.category,
    });
  }
  return map;
}

/** Sync map of slug → agent (logo + displayName) from the bundled snapshot. */
export function getCatalogAgentMap(): Map<string, Agent> {
  if (!cachedMap) cachedMap = buildMap();
  return cachedMap;
}

export function getCatalogAgent(slug: string): Agent {
  const hit = getCatalogAgentMap().get(slug);
  if (hit) return hit;
  return {
    name: slug,
    displayName: formatAgentDisplayName(slug),
    description: '',
  };
}
