import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { communityWritesEnabled } from './community.ts';

describe('communityWritesEnabled', () => {
  it('is off unless explicitly enabled', () => {
    delete process.env.COMMUNITY_WRITE_ENABLED;
    assert.equal(communityWritesEnabled(), false);
    process.env.COMMUNITY_WRITE_ENABLED = '1';
    assert.equal(communityWritesEnabled(), false);
    process.env.COMMUNITY_WRITE_ENABLED = 'true';
    assert.equal(communityWritesEnabled(), true);
    delete process.env.COMMUNITY_WRITE_ENABLED;
  });
});
