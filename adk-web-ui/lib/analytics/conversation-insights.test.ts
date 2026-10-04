import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILDER_APP,
  agentHealth,
  buildInsights,
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
    hasBuild: false,
    emailed: false,
    helpRequested: false,
    ...over,
  };
}

describe('conversationOutcome', () => {
  it('ranks emailed over zip over error over turn counts', () => {
    assert.equal(conversationOutcome({ emailed: true, hasBuild: true, errors: 1, userTurns: 1 }), 'emailed');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: true, errors: 1, userTurns: 1 }), 'zip');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: false, errors: 2, userTurns: 5 }), 'error');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: false, errors: 0, userTurns: 1 }), 'one-and-done');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: false, errors: 0, userTurns: 2 }), 'short');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: false, errors: 0, userTurns: 3 }), 'engaged');
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
  it('counts only builder conversations: started, continued, zip, emailed, help', () => {
    const rows = [
      conv({ appName: BUILDER_APP, userTurns: 1 }),
      conv({ appName: BUILDER_APP, userTurns: 3 }),
      conv({ appName: BUILDER_APP, userTurns: 4, hasBuild: true }),
      conv({ appName: BUILDER_APP, userTurns: 5, hasBuild: true, emailed: true, helpRequested: true }),
      conv({ appName: 'other', userTurns: 9, hasBuild: true, emailed: true }),
    ];
    const f = builderFunnel(rows);
    assert.deepEqual(f.map((s) => s.id), ['started', 'continued', 'zip', 'emailed', 'help']);
    assert.deepEqual(f.map((s) => s.label), ['Started a design', 'Answered a follow-up', 'Got a zip', 'Emailed it', 'Asked for help']);
    assert.deepEqual(f.map((s) => s.count), [4, 3, 2, 1, 1]);
    assert.deepEqual(f.map((s) => s.ofFirst), [100, 75, 50, 25, 25]);
    assert.equal(f[2].ofPrevious, 66.7);
    assert.equal(f[3].ofPrevious, 50);
    assert.equal(f[4].ofPrevious, 100);
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

describe('buildInsights', () => {
  const record = (over: object) => ({ sessionId: 's', userId: 'a_1', updatedAt: '', emailed: false, updates: false, help: false, build: {}, ...over });

  it('counts emails, opt-ins, options, models and tools, newest first', () => {
    const b = buildInsights([
      record({
        sessionId: 's1',
        updatedAt: '2026-10-01T00:00:00Z',
        emailed: true,
        updates: true,
        build: {
          name: 'one',
          options: { with_slack: true, with_eval: false },
          models: { fast: 'm1', reasoning: 'm2' },
          tools: ['Web_Search', 'web_search'],
          skills: ['x'],
          files: 10,
        },
      }),
      record({
        sessionId: 's2',
        updatedAt: '2026-10-02T00:00:00Z',
        help: true,
        build: { name: 'two', options: { with_slack: true, persona: true }, models: { fast: 'm1', reasoning: null }, tools: ['gmail'], files: 5 },
      }),
    ]);
    assert.deepEqual([b.total, b.emailed, b.updates, b.help], [2, 1, 1, 1]);
    assert.deepEqual(b.options.map((o) => [o.label, o.count, o.share]), [['Slack', 2, 100], ['Persona', 1, 50]]);
    assert.deepEqual(b.models.map((m) => [m.label, m.count]), [['m1', 2], ['m2', 1]]);
    assert.deepEqual(b.tools.map((t) => [t.label, t.count, t.share]), [['gmail', 1, 50], ['Web_Search', 1, 50]]);
    assert.deepEqual(b.recent.map((r) => r.sessionId), ['s2', 's1']);
    assert.deepEqual(b.recent[0].options, ['Persona', 'Slack']);
    assert.equal(b.recent[1].tools, 1);
    assert.equal(b.recent[1].files, 10);
  });

  it('survives malformed builds', () => {
    const b = buildInsights([record({ build: { options: 'x', tools: 3, models: [] } })]);
    assert.equal(b.total, 1);
    assert.equal(b.recent[0].name, 'Untitled build');
    assert.deepEqual(b.options, []);
  });
});

describe('buildHighlights', () => {
  const builderRows = [
    ...Array.from({ length: 20 }, () => conv({ appName: BUILDER_APP, userTurns: 1 })),
    ...Array.from({ length: 20 }, () => conv({ appName: BUILDER_APP, userTurns: 3, hasBuild: true })),
    ...Array.from({ length: 2 }, () => conv({ appName: BUILDER_APP, userTurns: 3, hasBuild: true, emailed: true })),
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
    nameOf: (s: string) => s.toUpperCase(),
  });

  it('names the weakest funnel step, with the overall conversion', () => {
    const h = buildHighlights(input(builderRows));
    const leak = h.find((x) => x.id === 'funnel-leak');
    assert.ok(leak);
    assert.match(leak.title, /zips get emailed/);
    assert.match(leak.detail, /emailed build/);
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
