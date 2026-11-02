import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bustDue, STATS_BUST_INTERVAL_MS } from './stats-cache.ts';

describe('bustDue', () => {
  it('busts at most once per interval', () => {
    assert.equal(bustDue(1_000_000, 0), true);
    assert.equal(bustDue(1_000_000 + STATS_BUST_INTERVAL_MS - 1, 1_000_000), false);
    assert.equal(bustDue(1_000_000 + STATS_BUST_INTERVAL_MS, 1_000_000), true);
  });
});
