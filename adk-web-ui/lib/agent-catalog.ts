/**
 * Offline / cold-start catalog for the agent directory.
 *
 * Priority when ADK /list-apps is unavailable:
 *   1. Last successful live list (in-memory, per warm instance)
 *   2. Filesystem scan of agents/<name>/metadata.json
 *   3. Committed snapshot (bundled with the UI for Vercel)
 *
 * Never serve the stale singleton image_agent fallback.
 */

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { formatAgentDisplayName } from './agent-utils';
import { loadAgentMetadata, type AgentMetadata } from './agent-metadata';
import type { Agent, AgentsListSource } from './types';
import snapshotJson from './agent-catalog.snapshot.json';

export type { AgentsListSource };
export type CatalogAgent = AgentMetadata;

type SnapshotAgent = {
  name: string;
  displayName?: string;
  description?: string;
  tools?: string[];
  tags?: string[];
  useCases?: Array<{ title: string; description: string }>;
  samplePrompts?: string[];
  author?: string;
  category?: string;
  logo?: string;
  githubUrl?: string;
  finalSubAgent?: string;
};

const snapshot = snapshotJson as {
  generatedAt?: string;
  agents: Array<string | SnapshotAgent>;
};

type LastGoodCache = {
  agents: CatalogAgent[];
  fetchedAt: number;
};

let lastGood: LastGoodCache | null = null;

/** Test / process isolation helper. */
export function clearLastGoodAgentsCache(): void {
  lastGood = null;
}

export function setLastGoodAgents(agents: CatalogAgent[]): void {
  if (!Array.isArray(agents) || agents.length === 0) return;
  lastGood = {
    agents: agents.map(cloneAgent),
    fetchedAt: Date.now(),
  };
}

export function getLastGoodAgents(): CatalogAgent[] | null {
  if (!lastGood?.agents?.length) return null;
  return lastGood.agents.map(cloneAgent);
}

export function getLastGoodFetchedAt(): number | null {
  return lastGood?.fetchedAt ?? null;
}

function cloneAgent(agent: CatalogAgent): CatalogAgent {
  return {
    ...agent,
    tools: [...(agent.tools ?? [])],
    tags: agent.tags ? [...agent.tags] : [],
    useCases: agent.useCases ? agent.useCases.map((uc) => ({ ...uc })) : [],
    samplePrompts: agent.samplePrompts ? [...agent.samplePrompts] : [],
  };
}

/** Resolve the monorepo `agents/` directory from common CWDs. */
export function resolveAgentsDir(cwd: string = process.cwd()): string | null {
  const candidates = [
    join(cwd, '..', 'agents'),
    join(cwd, 'agents'),
    join(cwd, '..', '..', 'agents'),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

function basicAgent(name: string): CatalogAgent {
  const displayName = formatAgentDisplayName(name);
  return {
    name,
    displayName,
    description: `Agent: ${displayName}`,
    tools: [],
    tags: [],
    useCases: [],
    samplePrompts: [],
  };
}

/** Enrich a list of ADK app names into catalog agents. */
export function resolveAgentsByName(names: string[]): CatalogAgent[] {
  return names
    .filter((name) => typeof name === 'string' && name.trim().length > 0)
    .map((name) => loadAgentMetadata(name) ?? basicAgent(name));
}

/**
 * Load the offline catalog: filesystem first, then committed snapshot.
 */
export function loadOfflineCatalog(): CatalogAgent[] {
  const fromDisk = loadCatalogFromDisk();
  if (fromDisk.length > 0) return fromDisk;
  return loadCatalogFromSnapshot();
}

export function loadCatalogFromDisk(cwd: string = process.cwd()): CatalogAgent[] {
  const agentsDir = resolveAgentsDir(cwd);
  if (!agentsDir) return [];

  try {
    const entries = readdirSync(agentsDir, { withFileTypes: true });
    const names = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
      .map((entry) => entry.name)
      .filter((name) => existsSync(join(agentsDir, name, 'metadata.json')))
      .sort((a, b) => a.localeCompare(b));

    return names.map((name) => loadAgentMetadata(name) ?? basicAgent(name));
  } catch (error) {
    console.warn('[agent-catalog] failed to scan agents directory:', error);
    return [];
  }
}

export function loadCatalogFromSnapshot(): CatalogAgent[] {
  const names = Array.isArray(snapshot?.agents) ? snapshot.agents : [];
  if (names.length === 0) return [];

  return names.map((entry) => {
    if (typeof entry === 'string') {
      return loadAgentMetadata(entry) ?? basicAgent(entry);
    }
    const name = entry.name;
    const fromDisk = loadAgentMetadata(name);
    if (fromDisk) return fromDisk;

    return {
      name,
      displayName: entry.displayName || formatAgentDisplayName(name),
      description: entry.description || `Agent: ${formatAgentDisplayName(name)}`,
      tools: Array.isArray(entry.tools) ? entry.tools : [],
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      useCases: Array.isArray(entry.useCases) ? entry.useCases : [],
      samplePrompts: Array.isArray(entry.samplePrompts) ? entry.samplePrompts : [],
      author: entry.author,
      category: entry.category,
      logo: entry.logo,
      githubUrl: entry.githubUrl,
      finalSubAgent: entry.finalSubAgent,
    };
  });
}

/**
 * Pick the best non-live agent list for cold starts / ADK outages.
 */
export function resolveFallbackAgents(): {
  agents: CatalogAgent[];
  source: Exclude<AgentsListSource, 'live'>;
} {
  const cached = getLastGoodAgents();
  if (cached?.length) {
    return { agents: cached, source: 'cache' };
  }

  const catalog = loadOfflineCatalog();
  return { agents: catalog, source: 'catalog' };
}

export function asPublicAgents(agents: CatalogAgent[]): Agent[] {
  return agents.map((agent) => ({
    ...agent,
    tags: agent.tags ?? [],
    useCases: agent.useCases ?? [],
    samplePrompts: agent.samplePrompts ?? [],
  }));
}
