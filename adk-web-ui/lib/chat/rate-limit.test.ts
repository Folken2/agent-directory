import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ANON_RATE_LIMIT_FALLBACK, extractRateLimit, isRateLimitError } from './rate-limit.ts';

describe('rate-limit parsing', () => {
  it('reads a top-level or axios-style payload', () => {
    assert.deepEqual(extractRateLimit({ rateLimit: { count: 3, limit: 10, userType: 'authenticated' } }), {
      count: 3,
      limit: 10,
      userType: 'authenticated',
    });
    assert.deepEqual(extractRateLimit({ response: { data: { rateLimit: { count: '2' } } } }), {
      count: 2,
      limit: ANON_RATE_LIMIT_FALLBACK,
      userType: 'anonymous',
    });
  });
  it('returns null without a payload', () => {
    assert.equal(extractRateLimit(null), null);
    assert.equal(extractRateLimit(new Error('boom')), null);
  });
  it('detects 429s from any surface', () => {
    assert.equal(isRateLimitError({ status: 429 }), true);
    assert.equal(isRateLimitError({ response: { status: 429 } }), true);
    assert.equal(isRateLimitError(new Error('HTTP 429 Too Many Requests')), true);
    assert.equal(isRateLimitError({ status: 500 }), false);
    assert.equal(isRateLimitError(undefined), false);
  });
});
