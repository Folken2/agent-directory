import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeQuery,
  shouldTrackPath,
  shouldTrackServerRequest,
  extractUtm,
} from './should-track.ts';

describe('shouldTrackPath', () => {
  it('tracks app pages', () => {
    assert.equal(shouldTrackPath('/'), true);
    assert.equal(shouldTrackPath('/agents/foo'), true);
    assert.equal(shouldTrackPath('/chat'), true);
  });

  it('skips api and next internals', () => {
    assert.equal(shouldTrackPath('/api/analytics/pageview'), false);
    assert.equal(shouldTrackPath('/_next/static/chunk.js'), false);
    assert.equal(shouldTrackPath('/favicon.ico'), false);
    assert.equal(shouldTrackPath('/logo.png'), false);
  });
});

describe('shouldTrackServerRequest', () => {
  it('tracks document navigations', () => {
    const headers = new Headers({ 'sec-fetch-dest': 'document' });
    assert.equal(
      shouldTrackServerRequest({
        pathname: '/',
        method: 'GET',
        headers,
        isBot: false,
      }),
      true
    );
  });

  it('skips RSC soft navigations', () => {
    const headers = new Headers({
      rsc: '1',
      'sec-fetch-dest': 'empty',
    });
    assert.equal(
      shouldTrackServerRequest({
        pathname: '/chat',
        method: 'GET',
        headers,
        isBot: false,
      }),
      false
    );
  });

  it('tracks bots even without sec-fetch-dest', () => {
    const headers = new Headers();
    assert.equal(
      shouldTrackServerRequest({
        pathname: '/',
        method: 'GET',
        headers,
        isBot: true,
      }),
      true
    );
  });
});

describe('sanitizeQuery / extractUtm', () => {
  it('redacts sensitive keys', () => {
    const out = sanitizeQuery('?utm_source=x&token=secret&foo=1');
    assert.ok(out?.includes('token=%5Bredacted%5D') || out?.includes('token=[redacted]'));
    assert.ok(out?.includes('utm_source=x'));
    assert.ok(out?.includes('foo=1'));
  });

  it('extracts utm params', () => {
    const utm = extractUtm('?utm_source=newsletter&utm_medium=email&utm_campaign=launch');
    assert.equal(utm.utmSource, 'newsletter');
    assert.equal(utm.utmMedium, 'email');
    assert.equal(utm.utmCampaign, 'launch');
  });
});
