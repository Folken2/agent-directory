import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { formatAgentDisplayName } from '@/lib/agent-utils';
import { getAgentStatsMap, isDbEnabled } from '@/lib/db';

const ADK_SERVER_URL = process.env.NEXT_PUBLIC_ADK_SERVER_URL || 'http://localhost:8000';

// Helper function to load metadata from agent directory
function loadAgentMetadata(agentName: string): {
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
} | null {
  try {
    // Path from API route to agent directories: go up one level from adk-web-ui to adk-samples, then into agents/
    const metadataPath = join(process.cwd(), '..', 'agents', agentName, 'metadata.json');

    if (existsSync(metadataPath)) {
      const metadataContent = readFileSync(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      // Always keep the backend-safe name coming from the directory/list-apps
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
      const useCases = Array.isArray(metadata.useCases) ? metadata.useCases : Array.isArray(metadata.use_cases) ? metadata.use_cases : [];
      const samplePrompts = Array.isArray(metadata.samplePrompts)
        ? metadata.samplePrompts
        : Array.isArray(metadata.sample_prompts)
          ? metadata.sample_prompts
          : [];
      const author = metadata.author || metadata.creator || undefined;
      const githubUrl = metadata.githubUrl || metadata.github_url || undefined;
      const documentation = metadata.documentation || metadata.docs || undefined;
      const version = metadata.version || undefined;
      const lastUpdated = metadata.lastUpdated || metadata.last_updated || undefined;
      const logo = metadata.logo || undefined;
      const category = metadata.category || undefined;

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
        documentation,
        version,
        lastUpdated,
        logo,
        category,
      };
    }
  } catch (error) {
    console.warn(`Failed to load metadata for ${agentName}:`, error);
  }

  return null;
}

// Fallback agents list
const FALLBACK_AGENTS = [
  {
    name: 'image_agent',
    description: 'AI assistant that generates images based on a prompt',
    tools: ['generate_image', 'load_artifacts'],
  },
  {
    name: 'simple_agent_web_search_EXA',
    description: 'AI assistant that grounds answers using web search and always cites sources',
    tools: ['web_search_async'],
  },
  {
    name: 'simple_agent_web_search',
    description: 'AI assistant that grounds answers using web search and always cites sources',
    tools: ['google_search'],
  },
];

export async function GET(_request: NextRequest) {
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  void _request;

  try {
    // Use correct ADK endpoint: GET /list-apps
    const response = await fetch(`${ADK_SERVER_URL}/list-apps`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      // Convert list of strings to Agent objects and enrich with metadata
      const agents = Array.isArray(data)
        ? data.map((appName: string) => {
          // First, try to load metadata from metadata.json file
          const fileMetadata = loadAgentMetadata(appName);
          if (fileMetadata) {
            return fileMetadata;
          }

          // Second, try to find metadata in fallback list
          const fallbackAgent = FALLBACK_AGENTS.find(a => a.name === appName);
          if (fallbackAgent) {
            return {
              ...fallbackAgent,
              displayName: formatAgentDisplayName(fallbackAgent.name)
            };
          }

          // If not found, return basic agent info with formatted display name
          return {
            name: appName,
            displayName: formatAgentDisplayName(appName),
            description: `Agent: ${formatAgentDisplayName(appName)}`,
            tools: [],
            tags: [],
            useCases: [],
            samplePrompts: [],
          };
        })
        : [];

      const agentsWithStats = await enrichWithStats(agents);

      return NextResponse.json({
        success: true,
        data: agentsWithStats,
      });
    }

    // If ADK server returned an error, log it but still return fallback agents
    console.warn(`ADK server returned ${response.status} for /list-apps, using fallback agents`);

    // Enrich fallback agents with metadata from files
    const enrichedFallbackAgents = FALLBACK_AGENTS.map(agent => {
      const fileMetadata = loadAgentMetadata(agent.name);
      return fileMetadata || {
        ...agent,
        displayName: formatAgentDisplayName(agent.name),
        tags: [],
        useCases: [],
        samplePrompts: [],
      };
    });

    const agentsWithStats = await enrichWithStats(enrichedFallbackAgents);

    return NextResponse.json({
      success: true,
      data: agentsWithStats,
    });
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    const isError = error instanceof Error;
    const message = isError ? error.message : '';
    const name = isError ? error.name : '';
    const causeCode =
      typeof error === 'object' &&
      error !== null &&
      'cause' in error &&
      typeof (error as { cause?: { code?: string } }).cause === 'object'
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;

    let errorMessage = message || 'Unknown error';

    // Provide more specific error messages
    if (name === 'AbortError') {
      errorMessage = 'Request timeout - ADK server did not respond within 5 seconds';
    } else if (message?.includes('fetch failed') || message?.includes('ECONNREFUSED') || causeCode === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to ADK server at ${ADK_SERVER_URL}. Make sure the ADK server is running. Start it with: adk api_server`;
    } else if (message?.includes('ENOTFOUND') || causeCode === 'ENOTFOUND') {
      errorMessage = `Cannot resolve hostname for ${ADK_SERVER_URL}. Check your network connection and server URL.`;
    }

    console.error('Error fetching agents from ADK server:', errorMessage, error);

    // If ADK server is not available, return fallback agents instead of error
    // This allows the UI to work even when ADK server is down
    // Enrich fallback agents with metadata from files
    const enrichedFallbackAgents = FALLBACK_AGENTS.map(agent => {
      const fileMetadata = loadAgentMetadata(agent.name);
      return fileMetadata || {
        ...agent,
        tags: [],
        useCases: [],
        samplePrompts: [],
      };
    });

    const agentsWithStats = await enrichWithStats(enrichedFallbackAgents);

    return NextResponse.json({
      success: true,
      data: agentsWithStats,
      warning: `ADK server unavailable: ${errorMessage}. Using fallback agents. Start the ADK server with: adk api_server`,
    });
  }
}

async function enrichWithStats(
  agents: Array<{
    name: string;
    displayName?: string;
    description: string;
    tools?: string[];
    tags?: string[];
    useCases?: Array<{ title: string; description: string }>;
    samplePrompts?: string[];
    category?: string;
  }>
) {
  if (!isDbEnabled()) {
    return agents;
  }

  try {
    const statsMap = await getAgentStatsMap(agents.map((a) => a.name));
    return agents.map((agent) => {
      const stats = statsMap[agent.name];
      return {
        ...agent,
        starsCount: stats?.stars_count ?? 0,
        runs: stats?.runs ?? 0,
        lastRunAt: stats?.last_run_at ?? null,
      };
    });
  } catch (error) {
    console.warn('Failed to load agent stats, returning agents without stats.', error);
    return agents;
  }
}
