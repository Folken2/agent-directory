/**
 * Shared ops analytics types — safe for client components (no DB imports).
 */

import type { TimelineRange } from './timeline-range';
import type { OpsSignal } from './signals';
import type {
  AgentHealthRow,
  BlueprintInsights,
  ConversationOutcome,
  ConversationOverview,
  DemandInsights,
  FunnelStep,
  Highlight,
  ToolUsageRow,
  TranscriptEntry,
} from './conversation-insights';

export type { TranscriptEntry };

export type AgentUsageRow = {
  agentSlug: string;
  runs: number;
  errors: number;
  errorRate: number;
  authedUsers: number;
  anonSessions: number;
  prompts: number;
  promptSessions: number;
  pageViews: number;
  firstRunAt: string | null;
  lastRunAt: string | null;
};

export type PageUsageRow = {
  path: string;
  views: number;
  humanViews: number;
  botViews: number;
  visitors: number;
  entries: number;
  exits: number;
  onwardRate: number;
  bounces: number;
};

export type MissingPathRow = {
  path: string;
  hits: number;
  visitors: number;
};

export type TrafficQuality = {
  totalViews: number;
  pageViews: number;
  scannerViews: number;
  missingViews: number;
  infraViews: number;
  humanPageViews: number;
  spoofedScannerViews: number;
  botPageViews: number;
};

export type PromptTheme = {
  term: string;
  prompts: number;
  agents: { agentSlug: string; prompts: number }[];
};

export type PromptThemes = {
  totalPrompts: number;
  samplePrompts: number;
  organicPrompts: number;
  distinctOrganicPrompts: number;
  unigrams: PromptTheme[];
  bigrams: PromptTheme[];
};

/** Google-signed-in account plus usage in the selected ops range. */
export type SignedInUserRow = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  signedUpAt: string;
  pageViews: number;
  runs: number;
  errors: number;
  agentsUsed: number;
  agentSlugs: string[];
  lastRunAt: string | null;
  lastViewAt: string | null;
  lastActiveAt: string | null;
};

export type OpsDashboardSnapshot = {
  range: TimelineRange;
  agents: AgentUsageRow[];
  users: SignedInUserRow[];
  pages: PageUsageRow[];
  missing: MissingPathRow[];
  quality: TrafficQuality;
  themes: PromptThemes;
  pageViewsSince: string | null;
  signals: OpsSignal[];
  catalogSlugs: string[];
};

/** One row of the ops conversation browser. */
export type ConversationListItem = {
  appName: string;
  sessionId: string;
  /** Email for signed-in users, otherwise a generic label. */
  user: string;
  startedAt: string;
  lastAt: string;
  userTurns: number;
  toolCalls: number;
  errors: number;
  tokens: number;
  firstPrompt: string;
  outcome: ConversationOutcome;
  friction: string[];
};

export type OpsInsights = {
  range: TimelineRange;
  /** False when there is no ADK store or nothing in range. */
  available: boolean;
  /** Plain-language findings, most important first. */
  highlights: Highlight[];
  overview: ConversationOverview;
  funnel: FunnelStep[];
  agents: AgentHealthRow[];
  demand: DemandInsights;
  blueprints: BlueprintInsights;
  tools: ToolUsageRow[];
  conversations: ConversationListItem[];
};
