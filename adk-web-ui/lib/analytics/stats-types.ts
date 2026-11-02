import type { TimelineRange } from './timeline-range';
import type { BotCategory } from './bots';
import type { RankedStat } from './dashboard-math';

export type { TimelineRange, RankedStat };

/** One crawler by name, most active first. */
export type BotStat = { botName: string; category: BotCategory; count: number };

/** Headline counts for one period. */
export type PeriodTotals = { visits: number; peopleApprox: number; returning: number; bots: number };

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
  /**
   * Human views on real app routes only (scanners / infra / missing excluded).
   * Same meaning as `humans` after the people-count fix.
   */
  visits: number;
  /**
   * Distinct `hashed_ip` among human page views, summed per UTC day (the hash
   * key rotates daily, so one person on three days counts three times).
   * Raw rows only: days already rolled up are not included.
   */
  peopleApprox: number;
  /**
   * Consented visitors only: distinct `ad_vid` seen on two or more UTC days in
   * the window. Without consent every hit gets a fresh id, so those visitors
   * can never count as returning.
   */
  returning: number;
  /** Same counts for the preceding window of equal length; null for all-time. */
  previous?: PeriodTotals | null;
  /** Human visits by page (normalized path), top first; tail folded into "Other". */
  topPages?: RankedStat[];
  /** Human visits by referring site; same-site and missing referrers are "Direct / none". */
  topSources?: RankedStat[];
  /** Human visits by device type. */
  devices?: RankedStat[];
  /** Human visits only, top countries by volume. */
  topCountries: CountryStat[];
  /** Individual crawlers, most active first. */
  byBot: BotStat[];
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
