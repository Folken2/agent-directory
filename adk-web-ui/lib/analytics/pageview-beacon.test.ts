import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pageviewBeacon } from './pageview-beacon.ts';

describe('pageviewBeacon', () => {
  it('skips the first render after a full load (middleware already counted it)', () => {
    assert.deepEqual(pageviewBeacon(null, '/guides/a?'), { send: false, nextKey: '/guides/a?' });
  });

  it('sends soft navigations to a new route', () => {
    assert.deepEqual(pageviewBeacon('/guides/a?', '/contact?'), { send: true, nextKey: '/contact?' });
  });

  it('does not resend the same route', () => {
    assert.equal(pageviewBeacon('/contact?', '/contact?').send, false);
  });

  it('counts each step of a load then two soft navigations once', () => {
    let key: string | null = null;
    let sent = 0;
    for (const k of ['/?', '/?', '/guides/a?', '/guides/a?', '/contact?']) {
      const r = pageviewBeacon(key, k);
      if (r.send) sent++;
      key = r.nextKey;
    }
    assert.equal(sent, 2);
  });
});
