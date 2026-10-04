import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSaveBuckets, validateBuildRequest } from './request.ts';

const body = { email: ' Me@Example.com ', sessionId: 'session-123', updates: true, help: false };

describe('validateBuildRequest', () => {
  it('normalizes a valid body', () => {
    assert.deepEqual(validateBuildRequest(body), {
      ok: true,
      value: { email: 'me@example.com', sessionId: 'session-123', updates: true, help: false },
    });
  });

  it('treats anything but true as an unticked box', () => {
    const r = validateBuildRequest({ ...body, updates: 'yes', help: 1 });
    assert.ok(r.ok);
    assert.deepEqual([r.value.updates, r.value.help], [false, false]);
  });

  it('rejects bad input with a log-safe reason', () => {
    assert.deepEqual(validateBuildRequest(null), { ok: false, reason: 'body' });
    assert.deepEqual(validateBuildRequest([]), { ok: false, reason: 'body' });
    assert.deepEqual(validateBuildRequest({ ...body, email: 'nope' }), { ok: false, reason: 'email' });
    assert.deepEqual(validateBuildRequest({ ...body, email: `${'a'.repeat(250)}@x.io` }), { ok: false, reason: 'email' });
    assert.deepEqual(validateBuildRequest({ ...body, sessionId: undefined }), { ok: false, reason: 'session' });
    assert.deepEqual(validateBuildRequest({ ...body, sessionId: '../x' }), { ok: false, reason: 'session' });
    assert.deepEqual(validateBuildRequest({ ...body, sessionId: 'a.b' }), { ok: false, reason: 'session' });
  });
});

describe('buildSaveBuckets', () => {
  const limits = { user: 10, anon: 3, anonIp: 10 };
  it('limits users and anonymous visitors separately under bd: keys', () => {
    assert.deepEqual(buildSaveBuckets({ kind: 'user', userId: 'u1' }, limits), [{ key: 'bd:u:u1', limit: 10 }]);
    assert.deepEqual(buildSaveBuckets({ kind: 'anon', anonToken: 'tok', ipHash: 'ip' }, limits), [
      { key: 'bd:a:tok', limit: 3 },
      { key: 'bd:ip:ip', limit: 10 },
    ]);
    assert.deepEqual(buildSaveBuckets({ kind: 'anon', anonToken: 'tok', ipHash: null }, limits), [{ key: 'bd:a:tok', limit: 3 }]);
  });
});
