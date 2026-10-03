import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deltaPct, formatAgo, formatDuration, niceTicks, pageLabel, rankShares, referrerSource } from './dashboard-math.ts';

describe('pageLabel', () => {
  it('names known routes and agent pages', () => {
    assert.equal(pageLabel('/'), 'Home');
    assert.equal(pageLabel('/examples'), 'Examples');
    assert.equal(pageLabel('/chat'), 'Chat');
    assert.equal(pageLabel('/agents/deep_research_agent'), 'Agent: Deep Research Agent');
    assert.equal(pageLabel('/privacy'), '/privacy');
  });
});

describe('referrerSource', () => {
  const own = ['agentdirectory.folch.ai', 'localhost'];
  it('groups by host and drops www', () => {
    assert.deepEqual(referrerSource('https://www.google.com/search?q=x', own), { id: 'google.com', label: 'google.com' });
    assert.deepEqual(referrerSource('https://news.ycombinator.com/item?id=1', own), {
      id: 'news.ycombinator.com',
      label: 'news.ycombinator.com',
    });
  });
  it('treats empty, invalid and self referrers as direct', () => {
    for (const r of [null, '', 'not a url', 'https://agentdirectory.folch.ai/examples', 'http://localhost:3000/']) {
      assert.deepEqual(referrerSource(r, own), { id: 'direct', label: 'Direct / none' });
    }
  });
});

describe('deltaPct', () => {
  it('computes signed change and handles empty baselines', () => {
    assert.equal(deltaPct(150, 100), 50);
    assert.equal(deltaPct(50, 100), -50);
    assert.equal(deltaPct(10, 0), null);
    assert.equal(deltaPct(0, 0), null);
    assert.equal(deltaPct(10, null), null);
  });
});

describe('niceTicks', () => {
  it('rounds to clean steps covering the max', () => {
    assert.deepEqual(niceTicks(0), [0, 1]);
    assert.deepEqual(niceTicks(7), [0, 2, 4, 6, 8]);
    assert.deepEqual(niceTicks(95), [0, 20, 40, 60, 80, 100]);
    assert.deepEqual(niceTicks(1234), [0, 500, 1000, 1500]);
    const t = niceTicks(37, 4);
    assert.ok(t[t.length - 1] >= 37 && t.length <= 6);
  });
});

describe('rankShares', () => {
  it('sorts, caps and folds the tail into Other', () => {
    const rows = rankShares(
      [
        { id: 'a', label: 'A', count: 5 },
        { id: 'b', label: 'B', count: 10 },
        { id: 'c', label: 'C', count: 3 },
        { id: 'd', label: 'D', count: 2 },
      ],
      2,
    );
    assert.deepEqual(rows.map((r) => [r.id, r.count, r.share]), [
      ['b', 10, 50],
      ['a', 5, 25],
      ['other', 5, 25],
    ]);
    assert.equal(rankShares([], 3).length, 0);
  });
});

describe('formatDuration', () => {
  it('scales units', () => {
    assert.equal(formatDuration(null), '—');
    assert.equal(formatDuration(850), '850 ms');
    assert.equal(formatDuration(12_440), '12.4 s');
    assert.equal(formatDuration(125_000), '2m 05s');
  });
});

describe('formatAgo', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  it('reads like a feed', () => {
    assert.equal(formatAgo('2026-10-03T11:59:40Z', now), 'just now');
    assert.equal(formatAgo('2026-10-03T11:55:00Z', now), '5 min ago');
    assert.equal(formatAgo('2026-10-03T09:00:00Z', now), '3 h ago');
    assert.equal(formatAgo('2026-10-01T12:00:00Z', now), '2 d ago');
    assert.equal(formatAgo('2026-07-01T12:00:00Z', now), 'Jul 1');
    assert.equal(formatAgo('nope', now), '');
  });
});
