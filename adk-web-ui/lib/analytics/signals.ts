/**
 * Deterministic ops Signals — findings with evidence and suggested actions.
 * No LLM. Thresholds live in {@link SIGNAL_THRESHOLDS} so tests can tune them.
 */

import type { AgentUsageRow, MissingPathRow, PageUsageRow, TrafficQuality } from './ops-types';
import type { PromptThemes } from './ops-types';

export type SignalSeverity = 'high' | 'medium' | 'info';

export type OpsSignal = {
  id: string;
  severity: SignalSeverity;
  title: string;
  evidence: string;
  suggestedAction: string;
  /** How identity / coverage should be read for this finding. */
  coverageBasis: string;
};

export const SIGNAL_THRESHOLDS = {
  /** Days without a terminal run before an agent is "dead". */
  deadAgentDays: 90,
  /** Minimum terminal runs before error-rate findings fire. */
  minRunsForFriction: 10,
  /** Error rate (0–1) above which friction is flagged. */
  highFrictionErrorRate: 0.15,
  /** Minimum human page views before "interest without use" fires. */
  minViewsInterest: 5,
  /** Minimum entries before a bounce-heavy page is "dead". */
  minEntriesDeadPage: 20,
  /** Bounce share of entries (0–1) for dead pages. */
  deadPageBounceRate: 0.85,
  /** Max onward rate for a dead page. */
  deadPageMaxOnward: 0.1,
  /** Distinct visitors required for a missing-path signal. */
  minMissingVisitors: 2,
  /** Minimum hits for a missing path. */
  minMissingHits: 3,
  /** Spoofed-scanner share of total views to flag traffic quality. */
  scannerShareWarn: 0.2,
} as const;

export type SignalsInput = {
  now?: Date;
  /** Catalog agent slugs (never-used agents need this). */
  catalogSlugs: readonly string[];
  agents: readonly AgentUsageRow[];
  pages: readonly PageUsageRow[];
  missing: readonly MissingPathRow[];
  quality: TrafficQuality;
  themes: PromptThemes;
  /** ISO timestamp of earliest page_view; null if none. */
  pageViewsSince: string | null;
};

function daysBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24);
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function buildDeadAgentSignals(
  agents: readonly AgentUsageRow[],
  catalogSlugs: readonly string[],
  now: Date,
  deadAgentDays: number
): OpsSignal[] {
  const bySlug = new Map(agents.map((a) => [a.agentSlug, a]));
  const dead: { slug: string; lastRunAt: string | null }[] = [];

  for (const slug of catalogSlugs) {
    const row = bySlug.get(slug);
    // Never used (no terminal run ever recorded) → treat as idle.
    if (!row?.lastRunAt) {
      dead.push({ slug, lastRunAt: null });
      continue;
    }
    if (daysBetween(now, new Date(row.lastRunAt)) >= deadAgentDays) {
      dead.push({ slug, lastRunAt: row.lastRunAt });
    }
  }

  // Also catch agents that appear in run data but not in catalog (orphans).
  for (const row of agents) {
    if (catalogSlugs.includes(row.agentSlug)) continue;
    if (!row.lastRunAt) continue;
    if (daysBetween(now, new Date(row.lastRunAt)) >= deadAgentDays) {
      dead.push({ slug: row.agentSlug, lastRunAt: row.lastRunAt });
    }
  }

  if (dead.length === 0) return [];

  const examples = dead
    .sort((a, b) => (a.lastRunAt ?? '').localeCompare(b.lastRunAt ?? ''))
    .slice(0, 5)
    .map((d) =>
      d.lastRunAt
        ? `${d.slug} (last ${d.lastRunAt.slice(0, 10)})`
        : d.slug
    )
    .join(', ');

  return [
    {
      id: 'dead-agents',
      severity: 'medium',
      title: `${dead.length} agent${dead.length === 1 ? '' : 's'} idle for ${deadAgentDays}+ days`,
      evidence: examples,
      suggestedAction:
        'Deprecate unused agents, or refresh their pitch and sample prompts if they still belong in the directory.',
      coverageBasis: 'Based on terminal runs in agent_run_events (all-time last_run when present).',
    },
  ];
}

export function buildHighFrictionSignals(
  agents: readonly AgentUsageRow[],
  minRuns: number,
  errorRate: number
): OpsSignal[] {
  const bad = agents
    .filter((a) => a.runs >= minRuns && a.errorRate >= errorRate)
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors);

  if (bad.length === 0) return [];

  const evidence = bad
    .slice(0, 5)
    .map((a) => `${a.agentSlug} ${a.errors}/${a.runs} errors (${pct(a.errorRate)})`)
    .join('; ');

  return [
    {
      id: 'high-friction',
      severity: 'high',
      title: `${bad.length} agent${bad.length === 1 ? '' : 's'} with high error rates`,
      evidence,
      suggestedAction:
        'Fix failing tools/prompts, or hide the agent until reliability recovers.',
      coverageBasis: `Terminal runs only; needs ≥${minRuns} runs before flagging.`,
    },
  ];
}

export function buildInterestWithoutUseSignals(
  agents: readonly AgentUsageRow[],
  pageViewsSince: string | null,
  minViews: number
): OpsSignal[] {
  if (!pageViewsSince) return [];

  const sinceMs = new Date(pageViewsSince).getTime();
  const hits = agents
    .filter((a) => {
      if (a.pageViews < minViews) return false;
      if (a.runs > 0) {
        // Ran only before pageview tracking — still "interest without use" in
        // the tracking era if last run is before pageViewsSince.
        if (!a.lastRunAt) return false;
        return new Date(a.lastRunAt).getTime() < sinceMs;
      }
      return true;
    })
    .sort((a, b) => b.pageViews - a.pageViews);

  if (hits.length === 0) return [];

  const evidence = hits
    .slice(0, 5)
    .map((a) => `${a.agentSlug}: ${a.pageViews} views, ${a.runs} runs in range`)
    .join('; ');

  return [
    {
      id: 'interest-without-use',
      severity: 'medium',
      title: `${hits.length} agent page${hits.length === 1 ? '' : 's'} viewed but not run`,
      evidence,
      suggestedAction:
        'Fix the agent experience (errors, cold start, CTA), not just the marketing copy.',
      coverageBasis: `Page views only exist since ${pageViewsSince.slice(0, 10)}; runs before that are ignored for this comparison.`,
    },
  ];
}

export function buildDeadPageSignals(
  pages: readonly PageUsageRow[],
  minEntries: number,
  bounceRate: number,
  maxOnward: number
): OpsSignal[] {
  const dead = pages
    .filter(
      (p) =>
        p.entries >= minEntries &&
        p.entries > 0 &&
        p.bounces / p.entries >= bounceRate &&
        p.onwardRate <= maxOnward
    )
    .sort((a, b) => b.bounces - a.bounces);

  if (dead.length === 0) return [];

  const evidence = dead
    .slice(0, 5)
    .map(
      (p) =>
        `${p.path}: ${p.bounces}/${p.entries} bounces, onward ${pct(p.onwardRate)}`
    )
    .join('; ');

  return [
    {
      id: 'dead-pages',
      severity: 'medium',
      title: `${dead.length} high-traffic page${dead.length === 1 ? '' : 's'} with almost no onward navigation`,
      evidence,
      suggestedAction:
        'Tighten the first viewport CTA, or remove/merge pages that never lead into agents.',
      coverageBasis: 'Journeys use hashed_ip + 30-minute windows (coarse session proxy).',
    },
  ];
}

export function buildMissingPageSignals(
  missing: readonly MissingPathRow[],
  minVisitors: number,
  minHits: number
): OpsSignal[] {
  const hits = missing
    .filter((m) => m.visitors >= minVisitors && m.hits >= minHits)
    .sort((a, b) => b.visitors - a.visitors || b.hits - a.hits);

  if (hits.length === 0) return [];

  const evidence = hits
    .slice(0, 8)
    .map((m) => `${m.path} (${m.hits} hits, ${m.visitors} visitors)`)
    .join('; ');

  return [
    {
      id: 'missing-pages',
      severity: 'info',
      title: `${hits.length} plausible missing path${hits.length === 1 ? '' : 's'} with repeat demand`,
      evidence,
      suggestedAction:
        'Add a real page or redirect if the path is intentional; ignore one-off locale scrapes.',
      coverageBasis: 'Requires repeat hits from distinct hashed IPs — single scrapers are filtered out.',
    },
  ];
}

export function buildDemandThemeSignals(themes: PromptThemes): OpsSignal[] {
  const top = [...themes.bigrams, ...themes.unigrams]
    .sort((a, b) => b.prompts - a.prompts || a.term.localeCompare(b.term))
    .slice(0, 8);

  if (top.length === 0 || themes.distinctOrganicPrompts < 2) {
    return [
      {
        id: 'demand-themes',
        severity: 'info',
        title: 'Not enough organic prompts to rank demand themes',
        evidence:
          themes.totalPrompts === 0
            ? 'No user prompts in this range.'
            : `${themes.totalPrompts} prompts (${themes.samplePrompts} catalog samples, ${themes.distinctOrganicPrompts} distinct organic).`,
        suggestedAction:
          'Wait for more organic usage, or widen the timeline range.',
        coverageBasis: 'ADK events author=user; sample prompts from the catalog are excluded.',
      },
    ];
  }

  const evidence = top
    .map((t) => `"${t.term}" ×${t.prompts}`)
    .join(', ');

  return [
    {
      id: 'demand-themes',
      severity: 'info',
      title: `Top demand themes from ${themes.distinctOrganicPrompts} organic prompts`,
      evidence,
      suggestedAction:
        'Consider new agents or sample prompts that match recurring themes; deprecate agents that never appear.',
      coverageBasis: `Sample clicks excluded (${themes.samplePrompts}). Frequency over distinct texts, not raw repeats.`,
    },
  ];
}

export function buildTrafficQualitySignals(
  quality: TrafficQuality,
  scannerShareWarn: number
): OpsSignal[] {
  if (quality.totalViews === 0) {
    return [
      {
        id: 'traffic-quality',
        severity: 'info',
        title: 'No page views in this range',
        evidence: 'page_views is empty for the selected window.',
        suggestedAction: 'Confirm Neon ingest and widen the range if needed.',
        coverageBasis: 'First-party page_views only.',
      },
    ];
  }

  const scannerShare =
    quality.totalViews > 0 ? quality.scannerViews / quality.totalViews : 0;
  const spoofShare =
    quality.totalViews > 0 ? quality.spoofedScannerViews / quality.totalViews : 0;

  if (scannerShare < scannerShareWarn && spoofShare < scannerShareWarn / 2) {
    return [
      {
        id: 'traffic-quality',
        severity: 'info',
        title: 'Traffic mix looks healthy',
        evidence: `${quality.humanPageViews} human page views; ${quality.scannerViews} scanner; ${quality.spoofedScannerViews} spoofed-UA scans.`,
        suggestedAction: 'No action — keep monitoring scanner share.',
        coverageBasis: 'Paths classified page/scanner/missing/infra; bots via UA rules.',
      },
    ];
  }

  return [
    {
      id: 'traffic-quality',
      severity: 'high',
      title: 'Large share of views are scanners, not readers',
      evidence: `${quality.scannerViews}/${quality.totalViews} scanner path views (${pct(scannerShare)}); ${quality.spoofedScannerViews} used non-bot UAs.`,
      suggestedAction:
        'Exclude scanner paths from product metrics (already done in ops). Do not chase “human” spikes that are credential probes.',
      coverageBasis: 'Scanner paths are allowlist-inverted; spoofed UAs still look human to UA-only checks.',
    },
  ];
}

/** Run all signal rules against a prepared ops snapshot. */
export function buildOpsSignals(input: SignalsInput): OpsSignal[] {
  const now = input.now ?? new Date();
  const t = SIGNAL_THRESHOLDS;

  return [
    ...buildDeadAgentSignals(
      input.agents,
      input.catalogSlugs,
      now,
      t.deadAgentDays
    ),
    ...buildHighFrictionSignals(
      input.agents,
      t.minRunsForFriction,
      t.highFrictionErrorRate
    ),
    ...buildInterestWithoutUseSignals(
      input.agents,
      input.pageViewsSince,
      t.minViewsInterest
    ),
    ...buildDeadPageSignals(
      input.pages,
      t.minEntriesDeadPage,
      t.deadPageBounceRate,
      t.deadPageMaxOnward
    ),
    ...buildMissingPageSignals(
      input.missing,
      t.minMissingVisitors,
      t.minMissingHits
    ),
    ...buildDemandThemeSignals(input.themes),
    ...buildTrafficQualitySignals(input.quality, t.scannerShareWarn),
  ];
}
