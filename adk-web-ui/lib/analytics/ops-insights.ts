/**
 * Assembles the ops Insights payload from the ADK conversation store.
 * Server-only (database access); the payload type lives in ops-types.
 */

import { BUILDER_EXAMPLE_PROMPTS } from '@/lib/builder';
import { getCatalogAgent } from '@/lib/agent-catalog-client';
import { fetchBuilderBuilds, fetchConversations, fetchToolUsage } from './adk-events';
import {
  agentHealth,
  buildInsights,
  buildHighlights,
  builderFunnel,
  conversationOutcome,
  demandInsights,
  frictionReasons,
  summarizeConversations,
} from './conversation-insights';
import { catalogSamplePromptTexts, normalizePromptText } from './prompt-themes';
import type { OpsInsights } from './ops-types';
import type { TimelineRange } from './timeline-range';

const LIST_LIMIT = 200;

/** Prompts we suggested (catalog samples and the home page chips). */
function suggestionMatcher(): (text: string) => boolean {
  const texts = new Set(catalogSamplePromptTexts());
  for (const p of BUILDER_EXAMPLE_PROMPTS) texts.add(normalizePromptText(p.prompt));
  return (text) => texts.has(normalizePromptText(text));
}

export async function fetchOpsInsights(range: TimelineRange): Promise<OpsInsights> {
  const [rows, builds, tools] = await Promise.all([
    fetchConversations(range),
    fetchBuilderBuilds(range),
    fetchToolUsage(range),
  ]);

  const overview = summarizeConversations(rows);
  const funnel = builderFunnel(rows);
  const agents = agentHealth(rows);
  const demand = demandInsights(rows, suggestionMatcher());
  const buildStats = buildInsights(builds);
  const nameOf = (slug: string) => getCatalogAgent(slug)?.displayName || slug;

  return {
    range,
    available: rows.length > 0 || builds.length > 0,
    highlights: buildHighlights({ overview, funnel, agents, demand, nameOf }),
    overview,
    funnel,
    agents,
    demand,
    builds: buildStats,
    tools,
    conversations: rows.slice(0, LIST_LIMIT).map((c) => ({
      appName: c.appName,
      sessionId: c.sessionId,
      user: c.userEmail ?? (c.userId.startsWith('u_') ? 'Signed-in user' : 'Anonymous'),
      startedAt: c.startedAt,
      lastAt: c.lastAt,
      userTurns: c.userTurns,
      toolCalls: c.toolCalls,
      errors: c.errors,
      tokens: c.inputTokens + c.outputTokens,
      firstPrompt: c.prompts[0] ?? '',
      outcome: conversationOutcome(c),
      friction: frictionReasons(c.prompts),
    })),
  };
}
