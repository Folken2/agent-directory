import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsOpsEmails, isAnalyticsOpsEmail } from './ops-access.ts';

describe('isAnalyticsOpsEmail', () => {
  it('fails closed when the env var is unset or empty', () => {
    assert.deepEqual(analyticsOpsEmails(''), []);
    assert.equal(isAnalyticsOpsEmail('owner@example.com', ''), false);
    assert.equal(isAnalyticsOpsEmail('owner@example.com', ' , '), false);
  });

  it('matches listed emails case-insensitively', () => {
    const env = 'Owner@Example.com, second@example.com';
    assert.equal(isAnalyticsOpsEmail('owner@example.com', env), true);
    assert.equal(isAnalyticsOpsEmail(' SECOND@example.com ', env), true);
    assert.equal(isAnalyticsOpsEmail('other@example.com', env), false);
  });

  it('rejects a missing email', () => {
    assert.equal(isAnalyticsOpsEmail(null, 'owner@example.com'), false);
  });
});
