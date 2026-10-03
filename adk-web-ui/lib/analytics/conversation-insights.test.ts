import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDER_APP,
  agentHealth,
  blueprintArchitecture,
  blueprintInsights,
  buildHighlights,
  builderFunnel,
  conversationOutcome,
  demandInsights,
  detectLanguage,
  frictionReasons,
  matchAll,
  INTEGRATIONS,
  DOMAINS,
  similarity,
  summarizeConversations,
  type ConversationRow,
} from './conversation-insights.ts';

function conv(over: Partial<ConversationRow> = {}): ConversationRow {
  return {
    appName: 'deep_research_agent',
    userId: 'a_x',
    sessionId: 's',
    userEmail: null,
    startedAt: '2026-10-01T10:00:00.000Z',
    lastAt: '2026-10-01T10:05:00.000Z',
    userTurns: 1,
    agentMessages: 1,
    toolCalls: 0,
    errors: 0,
    inputTokens: 0,
    outputTokens: 0,
    prompts: ['hello there'],
    firstReplyMs: 1000,
    hasBlueprint: false,
    saved: false,
    ...over,
  };
}

describe('conversationOutcome', () => {
  it('ranks saved over blueprint over error over turn counts', () => {
    assert.equal(conversationOutcome({ saved: true, hasBlueprint: true, errors: 1, userTurns: 1 }), 'saved');
    assert.equal(conversationOutcome({ saved: false, hasBlueprint: true, errors: 1, userTurns: 1 }), 'blueprint');
    assert.equal(conversationOutcome({ saved: false, hasBlueprint: false, errors: 2, userTurns: 5 }), 'error');
    assert.equal(conversationOutcome({ saved: false, hasBlueprint: false, errors: 0, userTurns: 1 }), 'one-and-done');
    assert.equal(conversationOutcome({ saved: false, hasBlueprint: false, errors: 0, userTurns: 2 }), 'short');
    assert.equal(conversationOutcome({ saved: false, hasBlueprint: false, errors: 0, userTurns: 3 }), 'engaged');
  });
});

describe('frictionReasons', () => {
  it('ignores the first message, which only describes the task', () => {
    assert.deepEqual(frictionReasons(['Build an agent that finds bugs in my code']), []);
  });

  it('picks up complaints in English and Spanish', () => {
    assert.deepEqual(frictionReasons(['task', "It doesn't work"]), ['not working']);
    assert.ok(frictionReasons(['task', 'no funciona nada']).includes('not working'));
    assert.ok(frictionReasons(['task', "That's not what I asked"]).includes('not what I asked'));
  });

  it('flags a near-identical follow-up as a repeated message', () => {
    assert.ok(
      frictionReasons(['find hotels in lisbon near the river', 'find hotels in lisbon near the river please']).includes(
        'repeated message'
      )
    );
    assert.deepEqual(frictionReasons(['find hotels in lisbon', 'what about restaurants nearby?']), []);
  });
});

describe('similarity', () => {
  it('is 1 for identical word sets and 0 for disjoint ones', () => {
    assert.equal(similarity('alpha beta gamma', 'gamma beta alpha'), 1);
    assert.equal(similarity('alpha beta', 'delta epsilon'), 0);
    assert.equal(similarity('', 'x'), 0);
  });
});

describe('matchers', () => {
  it('finds integrations by name, case-insensitively', () => {
    const ids = matchAll('Read GMail, post to #general on Slack and update the Google Sheet', INTEGRATIONS);
    assert.deepEqual(ids.sort(), ['gmail', 'google-sheets', 'slack']);
  });

  it('does not read "in order to" as e-commerce', () => {
    assert.equal(matchAll('summarize papers in order to save time', DOMAINS).includes('ecommerce'), false);
    assert.ok(matchAll('track Shopify orders', DOMAINS).includes('ecommerce'));
  });

  it('assigns overlapping domains', () => {
    const ids = matchAll('triage customer support emails and escalate refunds', DOMAINS);
    assert.ok(ids.includes('support'));
    assert.ok(ids.includes('productivity'));
  });
});

describe('detectLanguage', () => {
  it('uses the script for CJK, Cyrillic and Arabic', () => {
    assert.equal(detectLanguage('我想做一个旅行规划助手'), 'zh');
    assert.equal(detectLanguage('エージェントを作りたい'), 'ja');
    assert.equal(detectLanguage('Привет, нужен агент'), 'ru');
  });

  it('uses function words for Latin scripts', () => {
    assert.equal(detectLanguage('I want an agent that reads my email'), 'en');
    assert.equal(detectLanguage('Necesito un agente que responda a los clientes por WhatsApp'), 'es');
    assert.equal(detectLanguage('Un agent qui résume les appels et met à jour Salesforce'), 'fr');
  });
});

describe('summarizeConversations', () => {
  it('computes rates, medians and people', () => {
    const rows = [
      conv({ userId: 'u_1', userTurns: 1, firstReplyMs: 1000, inputTokens: 100, outputTokens: 50 }),
      conv({ userId: 'u_1', userTurns: 4, firstReplyMs: 3000, errors: 1 }),
      conv({ userId: 'a_2', userTurns: 2, firstReplyMs: 2000, prompts: ['a', "it doesn't work"] }),
      conv({ userId: 'a_3', userTurns: 3, firstReplyMs: null }),
    ];
    const s = summarizeConversations(rows);
    assert.equal(s.conversations, 4);
    assert.equal(s.messages, 10);
    assert.equal(s.people, 3);
    assert.equal(s.returningPeople, 1);
    assert.equal(s.signedInShare, 50);
    assert.equal(s.avgTurns, 2.5);
    assert.equal(s.oneAndDoneRate, 25);
    assert.equal(s.engagedRate, 50);
    assert.equal(s.errorRate, 25);
    assert.equal(s.frictionRate, 25);
    assert.equal(s.medianFirstReplyMs, 2000);
    assert.equal(s.p90FirstReplyMs, 3000);
    assert.equal(s.avgTokensPerConversation, 38);
  });

  it('is all zeros for no rows', () => {
    const s = summarizeConversations([]);
    assert.equal(s.conversations, 0);
    assert.equal(s.oneAndDoneRate, 0);
    assert.equal(s.medianFirstReplyMs, null);
  });
});

describe('agentHealth', () => {
  it('groups by agent, busiest first', () => {
    const rows = [conv({ appName: 'b' }), conv({ appName: 'a' }), conv({ appName: 'a', errors: 1 })];
    const health = agentHealth(rows);
    assert.deepEqual(health.map((h) => h.agentSlug), ['a', 'b']);
    assert.equal(health[0].errorRate, 50);
  });
});

describe('builderFunnel', () => {
  it('counts only builder conversations, with step and overall rates', () => {
    const rows = [
      conv({ appName: BUILDER_APP, userTurns: 1 }),
      conv({ appName: BUILDER_APP, userTurns: 3 }),
      conv({ appName: BUILDER_APP, userTurns: 4, hasBlueprint: true }),
      conv({ appName: BUILDER_APP, userTurns: 5, hasBlueprint: true, saved: true }),
      conv({ appName: 'other', userTurns: 9, hasBlueprint: true }),
    ];
    const f = builderFunnel(rows);
    assert.deepEqual(f.map((s) => s.count), [4, 3, 2, 1]);
    assert.deepEqual(f.map((s) => s.ofFirst), [100, 75, 50, 25]);
    assert.equal(f[2].ofPrevious, 66.7);
    assert.equal(f[3].ofPrevious, 50);
  });
});

describe('demandInsights', () => {
  it('sets suggestion clicks aside and shares by organic conversations', () => {
    const rows = [
      conv({ prompts: ['Suggested prompt'] }),
      conv({ prompts: ['Answer support tickets from Zendesk', 'also post in Slack'] }),
      conv({ prompts: ['Necesito un agente para ventas con HubSpot'] }),
      conv({ prompts: [] }),
    ];
    const d = demandInsights(rows, (t) => t === 'Suggested prompt');
    assert.equal(d.suggestionConversations, 1);
    assert.equal(d.organicConversations, 2);
    const integrations = Object.fromEntries(d.integrations.map((r) => [r.id, r.share]));
    assert.deepEqual(integrations, { hubspot: 50, slack: 50, zendesk: 50 });
    assert.ok(d.domains.some((r) => r.id === 'support'));
    assert.ok(d.domains.some((r) => r.id === 'sales'));
    assert.deepEqual(d.languages.map((r) => r.id).sort(), ['en', 'es']);
  });
});

describe('blueprints', () => {
  const doc = (agents: unknown[], tools: unknown[] = [], extra: object = {}) => ({ name: 'X', goal: 'G', agents, tools, ...extra });

  it('classifies architecture from agent kinds', () => {
    assert.equal(blueprintArchitecture(doc([{ kind: 'llm' }])), 'single');
    assert.equal(blueprintArchitecture(doc([{ kind: 'sequential' }, { kind: 'llm' }])), 'sequential');
    assert.equal(blueprintArchitecture(doc([{ kind: 'loop' }, { kind: 'llm' }])), 'loop');
    assert.equal(blueprintArchitecture(doc([{ kind: 'llm' }, { kind: 'llm' }])), 'routed');
    assert.equal(blueprintArchitecture(null), 'single');
  });

  it('counts tools and kinds once per blueprint and lists recent ones first', () => {
    const records = [
      {
        sessionId: 's1',
        userId: 'a_1',
        updatedAt: '2026-10-01T00:00:00Z',
        saved: true,
        doc: doc([{ kind: 'llm' }], [
          { name: 'Gmail_Read', kind: 'mcp' },
          { name: 'gmail_read', kind: 'mcp' },
        ], { dataSources: [{ name: 'd' }], models: [{ model: 'gemini-2.5-flash' }] }),
      },
      {
        sessionId: 's2',
        userId: 'a_2',
        updatedAt: '2026-10-02T00:00:00Z',
        saved: false,
        doc: doc([{ kind: 'sequential' }, { kind: 'llm' }], [{ name: 'google_search', kind: 'builtin' }]),
      },
    ];
    const b = blueprintInsights(records);
    assert.equal(b.total, 2);
    assert.equal(b.saved, 1);
    assert.equal(b.avgAgents, 1.5);
    assert.equal(b.withDataSources, 1);
    assert.deepEqual(b.tools.map((t) => [t.label, t.count, t.share]), [
      ['Gmail_Read', 1, 50],
      ['google_search', 1, 50],
    ]);
    assert.deepEqual(b.toolKinds.map((t) => t.id).sort(), ['builtin', 'mcp']);
    assert.deepEqual(b.recent.map((r) => r.sessionId), ['s2', 's1']);
    assert.equal(b.recent[0].architecture, 'Sequential pipeline');
  });

  it('survives malformed documents', () => {
    const b = blueprintInsights([{ sessionId: 's', userId: 'u', updatedAt: '', saved: false, doc: { agents: 'nope', tools: 3 } }]);
    assert.equal(b.total, 1);
    assert.equal(b.recent[0].name, 'Untitled design');
  });
});

describe('buildHighlights', () => {
  const builderRows = [
    ...Array.from({ length: 20 }, () => conv({ appName: BUILDER_APP, userTurns: 1 })),
    ...Array.from({ length: 20 }, () => conv({ appName: BUILDER_APP, userTurns: 3, hasBlueprint: true })),
    ...Array.from({ length: 2 }, () => conv({ appName: BUILDER_APP, userTurns: 3, hasBlueprint: true, saved: true })),
    ...Array.from({ length: 12 }, () => conv({ appName: 'slow', userTurns: 2, firstReplyMs: 30_000, errors: 1, prompts: ['x', 'it does not work'] })),
  ];
  const input = (rows: ConversationRow[]) => ({
    overview: summarizeConversations(rows),
    funnel: builderFunnel(rows),
    agents: agentHealth(rows),
    demand: demandInsights(
      rows.map((r, i) => ({ ...r, prompts: [i % 2 ? 'Answer support tickets in Zendesk' : 'Necesito un agente para ventas'] })),
      () => false
    ),
    blueprints: blueprintInsights([]),
    nameOf: (s: string) => s.toUpperCase(),
  });

  it('names the weakest funnel step, with the overall conversion', () => {
    const h = buildHighlights(input(builderRows));
    const leak = h.find((x) => x.id === 'funnel-leak');
    assert.ok(leak);
    assert.match(leak.title, /blueprints get saved/);
    assert.equal(leak.tone, 'risk');
  });

  it('calls out the agent with the most friction, errors and latency', () => {
    const h = buildHighlights(input(builderRows));
    assert.match(h.find((x) => x.id === 'friction')?.title ?? '', /^SLOW: friction in 100%/);
    assert.match(h.find((x) => x.id === 'errors')?.title ?? '', /^SLOW errors/);
    assert.match(h.find((x) => x.id === 'latency')?.title ?? '', /^SLOW is the slowest/);
  });

  it('reports demand and non-English share once there is a sample', () => {
    const h = buildHighlights(input(builderRows));
    assert.equal(h.find((x) => x.id === 'demand')?.tone, 'opportunity');
    assert.match(h.find((x) => x.id === 'languages')?.title ?? '', /aren't in English/);
  });

  it('stays quiet on tiny samples', () => {
    const rows = [conv({ appName: BUILDER_APP }), conv({ appName: 'x', errors: 1 })];
    assert.deepEqual(buildHighlights(input(rows)), []);
  });
});
