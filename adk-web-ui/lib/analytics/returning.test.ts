import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countReturningVisitors } from './returning.ts';

describe('countReturningVisitors', () => {
  it('does not count a multi-page visit on one day', () => {
    const rows = [
      { visitorId: 'a', day: '2026-11-01' },
      { visitorId: 'a', day: '2026-11-01' },
      { visitorId: 'a', day: '2026-11-01' },
    ];
    assert.equal(countReturningVisitors(rows), 0);
  });

  it('counts a visitor seen on two distinct days once', () => {
    const rows = [
      { visitorId: 'a', day: '2026-11-01' },
      { visitorId: 'a', day: '2026-11-02' },
      { visitorId: 'a', day: '2026-11-05' },
      { visitorId: 'b', day: '2026-11-02' },
    ];
    assert.equal(countReturningVisitors(rows), 1);
  });

  it('counts each returning visitor', () => {
    const rows = [
      { visitorId: 'a', day: '2026-11-01' },
      { visitorId: 'a', day: '2026-11-03' },
      { visitorId: 'b', day: '2026-11-02' },
      { visitorId: 'b', day: '2026-11-04' },
    ];
    assert.equal(countReturningVisitors(rows), 2);
  });
});
