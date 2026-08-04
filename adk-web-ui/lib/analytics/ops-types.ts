/**
 * Shared ops analytics types — safe for client components (no DB imports).
 */

import type { TimelineRange } from './timeline-range';
import type { OpsSignal } from './signals';

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

export type OpsDashboardSnapshot = {
  range: TimelineRange;
  agents: AgentUsageRow[];
  pages: PageUsageRow[];
  missing: MissingPathRow[];
  quality: TrafficQuality;
  themes: PromptThemes;
  pageViewsSince: string | null;
  signals: OpsSignal[];
  catalogSlugs: string[];
};
