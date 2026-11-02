import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { opsContentStart } from './adk-events.ts';

describe('opsContentStart', () => {
  const now = new Date('2026-11-02T03:30:00Z');

  it('uses the range start inside the 30-day window', () => {
    assert.equal(opsContentStart('7', now).toISOString(), '2026-10-27T00:00:00.000Z');
  });

  it('never reaches further back than 30 days, all-time included', () => {
    const floor = '2026-10-03T03:30:00.000Z';
    assert.equal(opsContentStart('90', now).toISOString(), floor);
    assert.equal(opsContentStart('all', now).toISOString(), floor);
  });
});
