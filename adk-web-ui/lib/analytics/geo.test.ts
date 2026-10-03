import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { geoFromHeaders, resolveGeo } from './geo.ts';

const h = (init: Record<string, string>) => new Headers(init);

describe('geoFromHeaders', () => {
  it('reads Cloudflare country', () => {
    assert.deepEqual(geoFromHeaders(h({ 'cf-ipcountry': 'ES' })), { country: 'ES', region: null, city: null });
  });
  it('ignores Cloudflare unknown/Tor markers', () => {
    assert.equal(geoFromHeaders(h({ 'cf-ipcountry': 'XX' })), null);
    assert.equal(geoFromHeaders(h({ 'cf-ipcountry': 'T1' })), null);
  });
  it('reads Vercel headers', () => {
    assert.deepEqual(
      geoFromHeaders(h({ 'x-vercel-ip-country': 'FR', 'x-vercel-ip-country-region': 'IDF', 'x-vercel-ip-city': 'Paris' })),
      { country: 'FR', region: 'IDF', city: 'Paris' }
    );
  });
});

describe('resolveGeo', () => {
  it('prefers headers over lookup', async () => {
    let called = false;
    const geo = await resolveGeo(h({ 'cf-ipcountry': 'ES' }), '1.1.1.1', async () => { called = true; return null; });
    assert.equal(geo.country, 'ES');
    assert.equal(called, false);
  });
  it('falls back to IP lookup, then to nulls', async () => {
    const found = await resolveGeo(h({}), '1.1.1.1', async () => ({ country: 'AU', region: 'NSW', city: 'Sydney' }));
    assert.equal(found.city, 'Sydney');
    const none = await resolveGeo(h({}), null, async () => ({ country: 'AU', region: null, city: null }));
    assert.deepEqual(none, { country: null, region: null, city: null });
    const failing = await resolveGeo(h({}), '1.1.1.1', async () => { throw new Error('io'); });
    assert.deepEqual(failing, { country: null, region: null, city: null });
  });
});
