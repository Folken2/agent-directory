import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gscDateRange, parseServiceAccount } from './search-console.ts';

describe('parseServiceAccount', () => {
  it('returns null when unset or malformed', () => {
    assert.equal(parseServiceAccount(undefined), null);
    assert.equal(parseServiceAccount(''), null);
    assert.equal(parseServiceAccount('{not json'), null);
    assert.equal(parseServiceAccount('{"client_email":"a@b"}'), null);
  });

  it('unescapes literal \\n in the private key', () => {
    const raw = JSON.stringify({ client_email: 'sa@x.iam.gserviceaccount.com', private_key: 'line1\\nline2' });
    assert.equal(parseServiceAccount(raw)?.private_key, 'line1\nline2');
  });
});

describe('gscDateRange', () => {
  it('covers the last N complete days ending yesterday', () => {
    const now = new Date('2026-11-02T15:00:00Z');
    assert.deepEqual(gscDateRange(28, now), { startDate: '2026-10-05', endDate: '2026-11-01' });
    assert.deepEqual(gscDateRange(1, now), { startDate: '2026-11-01', endDate: '2026-11-01' });
  });
});
