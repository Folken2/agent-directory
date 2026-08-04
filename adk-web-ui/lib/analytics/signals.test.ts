import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AgentUsageRow, PageUsageRow, TrafficQuality } from './ops-types';
import type { PromptThemes } from './ops-types';
import {
  SIGNAL_THRESHOLDS,
  buildDeadAgentSignals,
  buildDemandThemeSignals,
  buildHighFrictionSignals,
  buildInterestWithoutUseSignals,
  buildMissingPageSignals,
  buildOpsSignals,
  buildTrafficQualitySignals,
} from './signals';

const emptyQuality: TrafficQuality = {
  totalViews: 0,
  pageViews: 0,
  scannerViews: 0,
  missingViews: 0,
  infraViews: 0,
  humanPageViews: 0,
  spoofedScannerViews: 0,
  botPageViews: 0,
};

function agent(partial: Partial<AgentUsageRow> & { agentSlug: string }): AgentUsageRow {
  return {
    runs: 0,
    errors: 0,
    errorRate: 0,
    authedUsers: 0,
    anonSessions: 0,
    prompts: 0,
    promptSessions: 0,
    pageViews: 0,
    firstRunAt: null,
    lastRunAt: null,
    ...partial,
  };
}

describe('buildDeadAgentSignals', () => {
  it('flags never-used catalog agents and 90d+ idle ones', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    const signals = buildDeadAgentSignals(
      [
        agent({
          agentSlug: 'old',
          runs: 1,
          lastRunAt: '2026-01-01T00:00:00Z',
        }),
        agent({
          agentSlug: 'fresh',
          runs: 5,
          lastRunAt: '2026-07-20T00:00:00Z',
        }),
      ],
      ['old', 'fresh', 'never'],
      now,
      90
    );
    assert.equal(signals.length, 1);
    assert.match(signals[0].evidence, /never/);
    assert.match(signals[0].evidence, /old/);
    assert.doesNotMatch(signals[0].evidence, /fresh/);
  });
});

describe('buildHighFrictionSignals', () => {
  it('requires min runs before flagging error rate', () => {
    const none = buildHighFrictionSignals(
      [agent({ agentSlug: 'tiny', runs: 5, errors: 5, errorRate: 1 })],
      10,
      0.15
    );
    assert.equal(none.length, 0);

    const hit = buildHighFrictionSignals(
      [agent({ agentSlug: 'flaky', runs: 20, errors: 5, errorRate: 0.25 })],
      10,
      0.15
    );
    assert.equal(hit.length, 1);
    assert.equal(hit[0].severity, 'high');
    assert.match(hit[0].evidence, /flaky/);
  });
});

describe('buildInterestWithoutUseSignals', () => {
  it('skips when pageViewsSince is null', () => {
    assert.equal(
      buildInterestWithoutUseSignals(
        [agent({ agentSlug: 'a', pageViews: 100, runs: 0 })],
        null,
        5
      ).length,
      0
    );
  });

  it('flags views with no runs in the tracking era', () => {
    const signals = buildInterestWithoutUseSignals(
      [
        agent({ agentSlug: 'viewed', pageViews: 20, runs: 0 }),
        agent({
          agentSlug: 'old-runs',
          pageViews: 20,
          runs: 2,
          lastRunAt: '2026-06-01T00:00:00Z',
        }),
        agent({
          agentSlug: 'recent',
          pageViews: 20,
          runs: 2,
          lastRunAt: '2026-07-15T00:00:00Z',
        }),
        agent({ agentSlug: 'quiet', pageViews: 2, runs: 0 }),
      ],
      '2026-07-01T00:00:00Z',
      5
    );
    assert.equal(signals.length, 1);
    assert.match(signals[0].evidence, /viewed/);
    assert.match(signals[0].evidence, /old-runs/);
    assert.doesNotMatch(signals[0].evidence, /recent/);
    assert.doesNotMatch(signals[0].evidence, /quiet/);
  });
});

describe('buildMissingPageSignals', () => {
  it('requires repeat visitors', () => {
    assert.equal(
      buildMissingPageSignals(
        [{ path: '/fr', hits: 10, visitors: 1 }],
        2,
        3
      ).length,
      0
    );
    const hit = buildMissingPageSignals(
      [{ path: '/docs', hits: 5, visitors: 3 }],
      2,
      3
    );
    assert.equal(hit.length, 1);
    assert.match(hit[0].evidence, /\/docs/);
  });
});

describe('buildDemandThemeSignals', () => {
  it('explains thin organic coverage', () => {
    const themes: PromptThemes = {
      unigrams: [],
      bigrams: [],
      totalPrompts: 3,
      samplePrompts: 3,
      organicPrompts: 0,
      distinctOrganicPrompts: 0,
    };
    const signals = buildDemandThemeSignals(themes);
    assert.equal(signals.length, 1);
    assert.match(signals[0].title, /Not enough/);
  });

  it('lists top themes when organic volume exists', () => {
    const themes: PromptThemes = {
      unigrams: [
        {
          term: 'invoice',
          prompts: 4,
          agents: [{ agentSlug: 'a', prompts: 4 }],
        },
      ],
      bigrams: [
        {
          term: 'pdf extract',
          prompts: 5,
          agents: [{ agentSlug: 'a', prompts: 5 }],
        },
      ],
      totalPrompts: 20,
      samplePrompts: 2,
      organicPrompts: 18,
      distinctOrganicPrompts: 10,
    };
    const signals = buildDemandThemeSignals(themes);
    assert.match(signals[0].evidence, /pdf extract/);
    assert.match(signals[0].evidence, /invoice/);
  });
});

describe('buildTrafficQualitySignals', () => {
  it('warns when scanners dominate', () => {
    const quality: TrafficQuality = {
      ...emptyQuality,
      totalViews: 100,
      scannerViews: 40,
      spoofedScannerViews: 15,
      humanPageViews: 50,
      pageViews: 60,
    };
    const signals = buildTrafficQualitySignals(quality, 0.2);
    assert.equal(signals[0].severity, 'high');
    assert.match(signals[0].title, /scanner/i);
  });
});

describe('buildOpsSignals', () => {
  it('returns the full signal set for a rich fixture', () => {
    const now = new Date('2026-08-03T12:00:00Z');
    const pages: PageUsageRow[] = [
      {
        path: '/agents/dead-page',
        views: 50,
        humanViews: 50,
        botViews: 0,
        visitors: 40,
        entries: 30,
        exits: 28,
        onwardRate: 0.05,
        bounces: 27,
      },
    ];
    const signals = buildOpsSignals({
      now,
      catalogSlugs: ['never', 'flaky'],
      agents: [
        agent({
          agentSlug: 'flaky',
          runs: 20,
          errors: 8,
          errorRate: 0.4,
          lastRunAt: '2026-07-20T00:00:00Z',
          pageViews: 10,
        }),
      ],
      pages,
      missing: [{ path: '/pricing', hits: 4, visitors: 3 }],
      quality: {
        ...emptyQuality,
        totalViews: 100,
        pageViews: 80,
        humanPageViews: 70,
        scannerViews: 10,
      },
      themes: {
        unigrams: [
          {
            term: 'resume',
            prompts: 3,
            agents: [{ agentSlug: 'x', prompts: 3 }],
          },
        ],
        bigrams: [],
        totalPrompts: 10,
        samplePrompts: 1,
        organicPrompts: 9,
        distinctOrganicPrompts: 5,
      },
      pageViewsSince: '2026-07-01T00:00:00Z',
    });

    const ids = signals.map((s) => s.id);
    assert.ok(ids.includes('dead-agents'));
    assert.ok(ids.includes('high-friction'));
    assert.ok(ids.includes('dead-pages'));
    assert.ok(ids.includes('missing-pages'));
    assert.ok(ids.includes('demand-themes'));
    assert.ok(ids.includes('traffic-quality'));
    assert.ok(signals.every((s) => s.coverageBasis.length > 0));
    assert.equal(SIGNAL_THRESHOLDS.deadAgentDays, 90);
  });
});
