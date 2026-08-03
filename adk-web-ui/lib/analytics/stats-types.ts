import type { TimelineRange } from './timeline-range';
import type { BotAgentStat, BotCompanyStat } from './bot-companies';

export type { TimelineRange, BotAgentStat, BotCompanyStat };

export type TimelineDay = {
  day: string; // YYYY-MM-DD (UTC)
  total: number;
  humans: number;
  bots: number;
};

export type AgentEngagementStat = {
  agentSlug: string;
  messages: number;
  activeMs: number;
};

export type CountryStat = {
  country: string; // ISO 3166-1 alpha-2, or 'ZZ'
  name: string;
  flag: string;
  count: number;
  /** Percent of human visits, 0–100. */
  share: number;
};

export type PageviewStats = {
  total: number;
  humans: number;
  bots: number;
  /** Human visits only, top countries by volume. */
  topCountries: CountryStat[];
  /** Crawlers rolled up to the company that operates them. */
  botCompanies: BotCompanyStat[];
  /** Individual crawler user agents, most active first. */
  byBot: BotAgentStat[];
  /** Consent-gated active use — empty until users Accept analytics. */
  topAgents: AgentEngagementStat[];
  /** Daily series for the requested timeline range. */
  timeline: TimelineDay[];
  /** Echo of the range used to build `timeline`. */
  timelineRange: TimelineRange;
};

export function formatActiveLabel(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}
