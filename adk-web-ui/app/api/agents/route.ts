import { NextRequest, NextResponse } from 'next/server';
import {
  asPublicAgents,
  resolveAgentsByName,
  resolveFallbackAgents,
  setLastGoodAgents,
  type AgentsListSource,
} from '@/lib/agent-catalog';
import { getAgentStatsMap, isDbEnabled } from '@/lib/db';

export const maxDuration = 300;

const ADK_SERVER_URL = process.env.NEXT_PUBLIC_ADK_SERVER_URL || 'http://localhost:8000';

/** Cold / sleeping hosts (e.g. Railway) often need >30s before /list-apps responds. */
const LIST_APPS_TIMEOUT_MS = Math.max(
  5000,
  parseInt(process.env.ADK_LIST_APPS_TIMEOUT_MS || '120000', 10)
);
const LIST_APPS_MAX_ATTEMPTS = Math.max(1, parseInt(process.env.ADK_LIST_APPS_MAX_ATTEMPTS || '3', 10));
const LIST_APPS_RETRY_DELAY_MS = Math.max(0, parseInt(process.env.ADK_LIST_APPS_RETRY_DELAY_MS || '2500', 10));

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET /list-apps with long timeout and retries for gateway / connection failures.
 */
async function fetchAdkListApps(): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= LIST_APPS_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LIST_APPS_TIMEOUT_MS);

    try {
      const response = await fetch(`${ADK_SERVER_URL}/list-apps`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      const retryableStatus = response.status === 502 || response.status === 503 || response.status === 504;
      if (retryableStatus && attempt < LIST_APPS_MAX_ATTEMPTS) {
        console.warn(
          `[api/agents] list-apps attempt ${attempt}/${LIST_APPS_MAX_ATTEMPTS} HTTP ${response.status}, retrying in ${LIST_APPS_RETRY_DELAY_MS}ms`
        );
        await sleep(LIST_APPS_RETRY_DELAY_MS);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      const msg = err instanceof Error ? err.message : String(err);
      const causeCode =
        typeof err === 'object' &&
        err !== null &&
        'cause' in err &&
        typeof (err as { cause?: { code?: string } }).cause === 'object' &&
        (err as { cause?: { code?: string } }).cause !== null
          ? (err as { cause: { code?: string } }).cause.code
          : undefined;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isNetwork =
        msg.includes('fetch failed') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(causeCode || '');

      if ((isAbort || isNetwork) && attempt < LIST_APPS_MAX_ATTEMPTS) {
        console.warn(
          `[api/agents] list-apps attempt ${attempt}/${LIST_APPS_MAX_ATTEMPTS} failed (${isAbort ? 'timeout' : 'network'}), retrying in ${LIST_APPS_RETRY_DELAY_MS}ms`,
          err
        );
        await sleep(LIST_APPS_RETRY_DELAY_MS);
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new Error('list-apps failed after retries');
}

function fallbackWarning(reason: string, source: Exclude<AgentsListSource, 'live'>): string {
  const where =
    source === 'cache'
      ? 'Showing the last successful live directory.'
      : 'Showing the offline agent catalog.';
  return `${reason} ${where}`;
}

async function respondWithFallback(reason: string) {
  const { agents, source } = resolveFallbackAgents();
  const agentsWithStats = await enrichWithStats(asPublicAgents(agents));
  const warning = fallbackWarning(reason, source);

  console.warn(`[api/agents] ${warning} (source=${source}, count=${agentsWithStats.length})`);

  return NextResponse.json({
    success: true,
    data: agentsWithStats,
    source,
    stale: true,
    warning,
  });
}

export async function GET(_request: NextRequest) {
  void _request;

  try {
    const response = await fetchAdkListApps();

    if (response.ok) {
      const data = await response.json();
      const names = Array.isArray(data)
        ? data.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
        : [];
      const agents = resolveAgentsByName(names);
      setLastGoodAgents(agents);

      const agentsWithStats = await enrichWithStats(asPublicAgents(agents));

      return NextResponse.json({
        success: true,
        data: agentsWithStats,
        source: 'live' satisfies AgentsListSource,
        stale: false,
      });
    }

    return respondWithFallback(`ADK server returned ${response.status} for /list-apps.`);
  } catch (error: unknown) {
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

    if (name === 'AbortError') {
      errorMessage = `Request timeout - ADK server did not respond within ${LIST_APPS_TIMEOUT_MS / 1000}s (after ${LIST_APPS_MAX_ATTEMPTS} attempt(s))`;
    } else if (message?.includes('fetch failed') || message?.includes('ECONNREFUSED') || causeCode === 'ECONNREFUSED') {
      errorMessage = `Cannot connect to ADK server at ${ADK_SERVER_URL}`;
    } else if (message?.includes('ENOTFOUND') || causeCode === 'ENOTFOUND') {
      errorMessage = `Cannot resolve hostname for ${ADK_SERVER_URL}`;
    }

    console.error('Error fetching agents from ADK server:', errorMessage, error);

    return respondWithFallback(`ADK server unavailable: ${errorMessage}.`);
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
