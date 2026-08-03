import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasAnalyticsConsent,
  parseConsent,
} from './consent.ts';

describe('parseConsent', () => {
  it('accepts essential and all', () => {
    assert.equal(parseConsent('essential'), 'essential');
    assert.equal(parseConsent('all'), 'all');
  });

  it('returns null for missing or unknown values', () => {
    assert.equal(parseConsent(null), null);
    assert.equal(parseConsent(undefined), null);
    assert.equal(parseConsent(''), null);
    assert.equal(parseConsent('yes'), null);
  });
});

describe('hasAnalyticsConsent', () => {
  it('is true only for all', () => {
    assert.equal(hasAnalyticsConsent('all'), true);
    assert.equal(hasAnalyticsConsent('essential'), false);
    assert.equal(hasAnalyticsConsent(null), false);
  });
});
