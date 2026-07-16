/**
 * Server-side loader for agent metadata.json files.
 *
 * Lives next to lib/sessions.ts so server components / route handlers /
 * other server code that needs richer agent info than the bare slug can
 * use one canonical loader. Reads from `<repo-root>/agents/<name>/metadata.json`
 * relative to process.cwd().
 *
 * Returns null when the file is missing or unparseable; callers should
 * fall back to a slug-derived display name in that case.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { formatAgentDisplayName } from './agent-utils';

function resolveAgentsDir(cwd: string = process.cwd()): string | null {
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

export interface AgentMetadata {
  name: string;
  displayName: string;
  description: string;
  tools: string[];
  tags?: string[];
  useCases?: Array<{ title: string; description: string }>;
  samplePrompts?: string[];
  author?: string;
  githubUrl?: string;
  documentation?: string;
  version?: string;
  lastUpdated?: string;
  logo?: string;
  category?: string;
  finalSubAgent?: string;
}

export function loadAgentMetadata(agentName: string): AgentMetadata | null {
  try {
    const agentsDir = resolveAgentsDir();
    if (!agentsDir) return null;
    const metadataPath = join(agentsDir, agentName, 'metadata.json');
    if (!existsSync(metadataPath)) return null;

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

    const displayName =
      metadata.displayName ||
      metadata.display_name ||
      metadata.name ||
      formatAgentDisplayName(agentName);

    const description =
      typeof metadata.description === 'string' && metadata.description.trim().length > 0
        ? metadata.description
        : `Agent: ${displayName}`;

    const tools = Array.isArray(metadata.tools) ? metadata.tools : [];
    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
    const useCases = Array.isArray(metadata.useCases)
      ? metadata.useCases
      : Array.isArray(metadata.use_cases)
        ? metadata.use_cases
        : [];
    const samplePrompts = Array.isArray(metadata.samplePrompts)
      ? metadata.samplePrompts
      : Array.isArray(metadata.sample_prompts)
        ? metadata.sample_prompts
        : [];
    const author = metadata.author || metadata.creator || undefined;

    // Default to deriving the source link from the public repo when metadata
    // doesn't override it. Lets new agents get a "View source" link for free.
    const repoBase =
      process.env.NEXT_PUBLIC_AGENTS_REPO_URL ||
      'https://github.com/Folken2/agent-directory';
    const derivedGithubUrl = `${repoBase.replace(/\/$/, '')}/tree/main/agents/${agentName}`;
    const githubUrlRaw = metadata.githubUrl || metadata.github_url;
    const githubUrl = githubUrlRaw && githubUrlRaw.trim() ? githubUrlRaw : derivedGithubUrl;

    return {
      name: agentName,
      displayName,
      description,
      tools,
      tags,
      useCases,
      samplePrompts,
      author,
      githubUrl,
      documentation: metadata.documentation || metadata.docs || undefined,
      version: metadata.version || undefined,
      lastUpdated: metadata.lastUpdated || metadata.last_updated || undefined,
      logo: metadata.logo || undefined,
      category: metadata.category || undefined,
      finalSubAgent: metadata.finalSubAgent || metadata.final_sub_agent || undefined,
    };
  } catch (error) {
    console.warn(`Failed to load metadata for ${agentName}:`, error);
    return null;
  }
}
