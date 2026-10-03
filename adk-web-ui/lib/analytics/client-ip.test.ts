import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractClientIp } from './client-ip.ts';

const h = (init: Record<string, string>) => new Headers(init);

describe('extractClientIp', () => {
  it('defaults to the first x-forwarded-for entry', () => {
    assert.equal(extractClientIp(h({ 'x-forwarded-for': '1.1.1.1, 10.0.0.1' }), undefined), '1.1.1.1');
  });
  it('honours a trusted single-value header', () => {
    assert.equal(extractClientIp(h({ 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '6.6.6.6' }), 'x-real-ip'), '2.2.2.2');
  });
  it('can take the last x-forwarded-for hop (proxy-appended)', () => {
    assert.equal(extractClientIp(h({ 'x-forwarded-for': '6.6.6.6, 3.3.3.3' }), 'x-forwarded-for:last'), '3.3.3.3');
  });
  it('returns null when the trusted header is absent', () => {
    assert.equal(extractClientIp(h({ 'x-forwarded-for': '6.6.6.6' }), 'x-real-ip'), null);
  });
});
