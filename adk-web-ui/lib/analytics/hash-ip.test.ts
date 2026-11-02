import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractClientIp, hashIp } from './hash-ip.ts';

describe('hashIp', () => {
  it('returns null for empty ip', () => {
    assert.equal(hashIp(null), null);
    assert.equal(hashIp(''), null);
  });

  it('is stable for the same salt', () => {
    const a = hashIp('1.2.3.4', 'salt');
    const b = hashIp('1.2.3.4', 'salt');
    assert.equal(a, b);
    assert.equal(a?.length, 64);
  });

  it('changes with salt', () => {
    assert.notEqual(hashIp('1.2.3.4', 'a'), hashIp('1.2.3.4', 'b'));
  });

  it('is stable within one UTC day', () => {
    const morning = new Date('2026-11-02T00:00:01Z');
    const night = new Date('2026-11-02T23:59:59Z');
    assert.equal(hashIp('1.2.3.4', 'salt', morning), hashIp('1.2.3.4', 'salt', night));
  });

  it('rotates at UTC midnight', () => {
    const today = new Date('2026-11-02T23:59:59Z');
    const tomorrow = new Date('2026-11-03T00:00:00Z');
    assert.notEqual(hashIp('1.2.3.4', 'salt', today), hashIp('1.2.3.4', 'salt', tomorrow));
  });
});

describe('extractClientIp', () => {
  it('prefers first x-forwarded-for hop', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      'x-real-ip': '10.0.0.1',
    });
    assert.equal(extractClientIp(headers), '203.0.113.10');
  });
});
