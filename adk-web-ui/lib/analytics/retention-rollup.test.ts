import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSignedInAdkSession,
  rawCutoff,
  referrerHost,
  rollUpEngagement,
  rollUpPageViews,
  transcriptCutoff,
} from './retention-rollup.ts';

describe('retention cutoffs', () => {
  const now = new Date('2026-11-02T03:30:00Z');

  it('rolls up whole UTC days older than 90 days', () => {
    assert.equal(rawCutoff(now).toISOString(), '2026-08-04T00:00:00.000Z');
  });

  it('prunes transcripts after 30 days', () => {
    assert.equal(transcriptCutoff(now).toISOString(), '2026-10-03T03:30:00.000Z');
  });
});

describe('referrerHost', () => {
  it('keeps the host only', () => {
    assert.equal(referrerHost('https://www.google.com/search?q=adk'), 'google.com');
    assert.equal(referrerHost(null), '');
    assert.equal(referrerHost('not a url'), '');
  });
});

describe('rollUpPageViews', () => {
  it('groups by day and dimensions and drops identifiers', () => {
    const base = {
      day: '2026-08-01',
      path: '/',
      isBot: false,
      botName: null,
      country: 'ES',
      deviceType: 'desktop',
      referrer: 'https://google.com/x',
    };
    const rows = rollUpPageViews([
      base,
      { ...base, referrer: 'https://www.google.com/y' },
      { ...base, country: null },
      { ...base, isBot: true, botName: 'GPTBot', referrer: null },
    ]);
    assert.equal(rows.length, 3);
    const google = rows.find((r) => r.country === 'ES' && !r.isBot)!;
    assert.equal(google.views, 2);
    assert.equal(google.refHost, 'google.com');
    assert.equal(rows.find((r) => r.country === '')!.views, 1);
    const bot = rows.find((r) => r.isBot)!;
    assert.equal(bot.botName, 'GPTBot');
    assert.deepEqual(Object.keys(google).sort(), ['botName', 'country', 'day', 'deviceType', 'isBot', 'path', 'refHost', 'views']);
  });

  it('never keeps a bot name on human rows', () => {
    const [row] = rollUpPageViews([
      { day: '2026-08-01', path: '/', isBot: false, botName: 'x', country: null, deviceType: null, referrer: null },
    ]);
    assert.equal(row.botName, '');
  });
});

describe('rollUpEngagement', () => {
  it('counts events, distinct visits and dwell per landing page', () => {
    const base = { day: '2026-08-01', eventType: 'try_agent', agentSlug: 'a', path: '/guides/g', durationMs: null };
    const rows = rollUpEngagement([
      { ...base, visitorId: 'v1', metadata: JSON.stringify({ landing: '/guides/g', visit: 'k1' }) },
      { ...base, visitorId: 'v2', metadata: JSON.stringify({ landing: '/guides/g', visit: 'k1' }) },
      { ...base, visitorId: 'v3', metadata: JSON.stringify({ landing: '/guides/g', visit: 'k2' }) },
      { ...base, visitorId: 'v4', metadata: '{broken' },
      { ...base, eventType: 'heartbeat', visitorId: 'v1', durationMs: 30_000, metadata: null },
      { ...base, eventType: 'heartbeat', visitorId: 'v1', durationMs: 15_000, metadata: null },
    ]);
    const landed = rows.find((r) => r.eventType === 'try_agent' && r.landingPath === '/guides/g')!;
    assert.equal(landed.events, 3);
    assert.equal(landed.visits, 2);
    const noLanding = rows.find((r) => r.eventType === 'try_agent' && r.landingPath === '')!;
    assert.equal(noLanding.events, 1);
    assert.equal(noLanding.visits, 1);
    const beats = rows.find((r) => r.eventType === 'heartbeat')!;
    assert.deepEqual([beats.events, beats.visits, beats.durationMs], [2, 1, 45_000]);
  });
});

describe('isSignedInAdkSession', () => {
  it('keeps signed-in users and drops anonymous visitors', () => {
    assert.equal(isSignedInAdkSession('u_3f2b1c4d-0000-4000-8000-000000000000'), true);
    assert.equal(isSignedInAdkSession('a_9c1e7f'), false);
  });

  it('keeps a legacy default-user session only when its runs were authenticated', () => {
    assert.equal(isSignedInAdkSession('default-user', true), true);
    assert.equal(isSignedInAdkSession('default-user', false), false);
    assert.equal(isSignedInAdkSession('default-user'), false);
  });

  it('does not treat a lookalike id as signed in', () => {
    assert.equal(isSignedInAdkSession('U_abc'), false);
    assert.equal(isSignedInAdkSession('xu_abc'), false);
    assert.equal(isSignedInAdkSession('a_u_abc'), false);
  });
});
