import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INGEST_IP_HEADER,
  INGEST_SIGNATURE_HEADER,
  ingestSecret,
  signForwardedClient,
  verifyForwardedClient,
} from './internal-ingest.ts';

const client = { ip: '203.0.113.7', country: 'ES', region: 'CT', city: 'Barcelona' };
const now = 1_793_600_000_000;

describe('internal ingest signature', () => {
  it('round-trips a signed client', async () => {
    const headers = new Headers(await signForwardedClient(client, 's3cret', now));
    assert.deepEqual(await verifyForwardedClient(headers, 's3cret', now + 1000), client);
  });

  it('rejects a forged IP', async () => {
    const headers = new Headers(await signForwardedClient(client, 's3cret', now));
    headers.set(INGEST_IP_HEADER, '198.51.100.1');
    assert.equal(await verifyForwardedClient(headers, 's3cret', now), null);
  });

  it('rejects the wrong secret, a stale signature and a missing header', async () => {
    const headers = new Headers(await signForwardedClient(client, 's3cret', now));
    assert.equal(await verifyForwardedClient(headers, 'other', now), null);
    assert.equal(await verifyForwardedClient(headers, 's3cret', now + 6 * 60 * 1000), null);
    headers.delete(INGEST_SIGNATURE_HEADER);
    assert.equal(await verifyForwardedClient(headers, 's3cret', now), null);
  });

  it('sends nothing without a secret', async () => {
    assert.deepEqual(await signForwardedClient(client, null, now), {});
  });

  it('prefers ANALYTICS_INGEST_SECRET and derives one from AUTH_SECRET otherwise', () => {
    assert.equal(ingestSecret({ ANALYTICS_INGEST_SECRET: 'a', AUTH_SECRET: 'b' }), 'a');
    assert.notEqual(ingestSecret({ AUTH_SECRET: 'b' }), 'b');
    assert.equal(ingestSecret({}), null);
  });
});
