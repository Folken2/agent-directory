import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGoalFunnel, funnelRate, funnelStepFor, type FunnelEvent } from './funnel.ts';

const ev = (eventType: string, landing: string | null, visit: string, path = landing ?? '/'): FunnelEvent => ({
  eventType,
  landing,
  visit,
  path,
});

describe('funnelStepFor', () => {
  it('maps events to steps', () => {
    assert.equal(funnelStepFor('agent_open'), 'chat');
    assert.equal(funnelStepFor('try_agent'), 'chat');
    assert.equal(funnelStepFor('builder_start'), 'builder');
    assert.equal(funnelStepFor('build_emailed'), 'emailed');
    assert.equal(funnelStepFor('contact_click'), 'contact');
    assert.equal(funnelStepFor('contact_email'), 'contact');
    assert.equal(funnelStepFor('heartbeat'), null);
    assert.equal(funnelStepFor('copy_page'), null);
  });
});

describe('funnelRate', () => {
  it('is 0 with nothing to divide by', () => {
    assert.equal(funnelRate(3, 0), 0);
    assert.equal(funnelRate(1, 4), 0.25);
  });
});

describe('buildGoalFunnel', () => {
  const guide = '/guides/adk-mcp';
  const funnel = buildGoalFunnel({
    visitLandings: [guide, guide, guide, guide, '/', '/'],
    events: [
      // visit g1 opens chat twice (try_agent then agent_open): one visit
      ev('try_agent', guide, 'g1'),
      ev('agent_open', guide, 'g1', '/chat'),
      ev('builder_start', guide, 'g2', '/'),
      ev('build_emailed', guide, 'g2', '/chat'),
      ev('contact_click', guide, 'g3'),
      ev('contact_email', guide, 'g3', '/contact'),
      // landed on home, clicked contact on the guide
      ev('contact_click', '/', 'h1', guide),
      ev('builder_start', null, 'x1', '/'),
    ],
    pageViews: new Map([
      [guide, 9],
      ['/guides/other', 2],
      ['/', 5],
    ]),
  });

  it('counts each visit once per step, credited to the landing page', () => {
    const row = funnel.byLanding.find((r) => r.landing === guide)!;
    assert.deepEqual(
      { visits: row.visits, chat: row.chat, builder: row.builder, emailed: row.emailed, contact: row.contact },
      { visits: 4, chat: 1, builder: 1, emailed: 1, contact: 1 }
    );
    const home = funnel.byLanding.find((r) => r.landing === '/')!;
    assert.equal(home.visits, 2);
    assert.equal(home.contact, 1);
  });

  it('keeps events without a landing page under (unknown)', () => {
    const unknown = funnel.byLanding.find((r) => r.landing === '(unknown)')!;
    assert.equal(unknown.visits, 0);
    assert.equal(unknown.builder, 1);
  });

  it('totals count distinct visits across landings', () => {
    assert.equal(funnel.totals.visits, 6);
    assert.equal(funnel.totals.chat, 1);
    assert.equal(funnel.totals.builder, 2);
    assert.equal(funnel.totals.emailed, 1);
    assert.equal(funnel.totals.contact, 2);
  });

  it('builds guide rows from landing or click location', () => {
    const row = funnel.guides.find((g) => g.path === guide)!;
    assert.deepEqual(row, { path: guide, views: 9, tryAgent: 1, builderStart: 1, contactClick: 2 });
    const other = funnel.guides.find((g) => g.path === '/guides/other')!;
    assert.deepEqual(other, { path: '/guides/other', views: 2, tryAgent: 0, builderStart: 0, contactClick: 0 });
    assert.equal(funnel.guides[0].path, guide);
  });
});
