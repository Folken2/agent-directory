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

describe('resolveGeo IP filtering', () => {
  const NULLS = { country: null, region: null, city: null };
  const spy = () => {
    const calls: string[] = [];
    const fn = async (ip: string) => { calls.push(ip); return { country: 'US', region: null, city: null }; };
    return { calls, fn };
  };

  it('skips lookup for IPv6 (fast-geoip is IPv4-only)', async () => {
    const s = spy();
    assert.deepEqual(await resolveGeo(h({}), '2606:4700::1111', s.fn), NULLS);
    assert.deepEqual(s.calls, []);
  });
  it('unwraps IPv4-mapped IPv6 before lookup', async () => {
    const s = spy();
    const geo = await resolveGeo(h({}), '::ffff:8.8.8.8', s.fn);
    assert.equal(geo.country, 'US');
    assert.deepEqual(s.calls, ['8.8.8.8']);
  });
  it('skips lookup for private and reserved IPv4', async () => {
    const s = spy();
    for (const ip of ['10.0.0.1', '192.168.1.1', '172.16.5.4', '127.0.0.1', '169.254.1.1', '100.64.0.1', '0.1.2.3', '224.0.0.1', '255.255.255.255']) {
      assert.deepEqual(await resolveGeo(h({}), ip, s.fn), NULLS, ip);
    }
    assert.deepEqual(s.calls, []);
  });
  it('still looks up public IPv4 at range edges', async () => {
    const s = spy();
    for (const ip of ['172.32.0.1', '100.128.0.1', '223.255.255.255']) await resolveGeo(h({}), ip, s.fn);
    assert.deepEqual(s.calls, ['172.32.0.1', '100.128.0.1', '223.255.255.255']);
  });
});
