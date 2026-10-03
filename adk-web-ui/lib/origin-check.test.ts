import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, isAllowedOrigin } from './origin-check.ts';

const SITE = ['https://agentdirectory.folch.ai'];
const h = (init: Record<string, string>) => new Headers(init);

describe('isAllowedOrigin', () => {
  it('allows a matching Origin header', () => {
    assert.equal(isAllowedOrigin(h({ origin: 'https://agentdirectory.folch.ai' }), SITE), true);
  });
  it('rejects a foreign Origin header', () => {
    assert.equal(isAllowedOrigin(h({ origin: 'https://evil.example' }), SITE), false);
  });
  it('falls back to Sec-Fetch-Site', () => {
    assert.equal(isAllowedOrigin(h({ 'sec-fetch-site': 'same-origin' }), SITE), true);
    assert.equal(isAllowedOrigin(h({ 'sec-fetch-site': 'cross-site' }), SITE), false);
  });
  it('allows non-browser clients with neither header', () => {
    assert.equal(isAllowedOrigin(h({}), SITE), true);
  });
});

describe('allowedOrigins', () => {
  it('includes the request origin and configured base urls, normalized', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://agentdirectory.folch.ai/';
    const list = allowedOrigins('http://localhost:3000');
    assert.ok(list.includes('http://localhost:3000'));
    assert.ok(list.includes('https://agentdirectory.folch.ai'));
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });
});
