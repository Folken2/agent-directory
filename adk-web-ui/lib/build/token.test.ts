import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashBuildToken, isBuildToken, newBuildToken } from './token.ts';

describe('build tokens', () => {
  it('are 32 random bytes in base64url, stored only as sha256', () => {
    const t = newBuildToken();
    assert.equal(t.token.length, 43);
    assert.ok(isBuildToken(t.token));
    assert.match(t.hash, /^[0-9a-f]{64}$/);
    assert.equal(t.hash, hashBuildToken(t.token));
    assert.notEqual(newBuildToken().token, t.token);
  });

  it('uses the given byte source', () => {
    const t = newBuildToken(() => Buffer.alloc(32, 0xff));
    assert.equal(t.token, '_'.repeat(42) + '8');
    assert.equal(t.hash, hashBuildToken(t.token));
  });

  it('rejects malformed tokens', () => {
    assert.equal(isBuildToken('short'), false);
    assert.equal(isBuildToken('a'.repeat(42) + '/'), false);
    assert.equal(isBuildToken(undefined), false);
  });
});
