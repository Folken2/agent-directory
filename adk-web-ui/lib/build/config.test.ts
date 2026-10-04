import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAX_ZIP_BYTES, buildConfig, buildLink, safeBookingUrl } from './config.ts';

describe('buildConfig', () => {
  it('defaults to dev mode with no deployment values', () => {
    const c = buildConfig({});
    assert.equal(c.email, null);
    assert.equal(c.segmentId, null);
    assert.equal(c.bookingUrl, null);
    assert.equal(c.baseUrl, null);
    assert.equal(c.maxZipBytes, DEFAULT_MAX_ZIP_BYTES);
    assert.equal(DEFAULT_MAX_ZIP_BYTES, 10 * 1024 * 1024);
    assert.deepEqual(c.limits, { user: 10, anon: 3, anonIp: 10 });
    assert.deepEqual(c.webhook, { url: undefined, secret: undefined });
  });

  it('needs both the key and the sender to send email', () => {
    assert.equal(buildConfig({ RESEND_API_KEY: 're_x' }).email, null);
    assert.equal(buildConfig({ BUILD_EMAIL_FROM: 'A <a@b.test>' }).email, null);
    assert.deepEqual(buildConfig({ RESEND_API_KEY: 're_x', BUILD_EMAIL_FROM: 'A <a@b.test>', BUILD_EMAIL_REPLY_TO: 'r@b.test' }).email, {
      apiKey: 're_x',
      from: 'A <a@b.test>',
      replyTo: 'r@b.test',
    });
  });

  it('prefers BUILD_* and falls back to BLUEPRINT_*', () => {
    const legacy = buildConfig({
      BLUEPRINT_WEBHOOK_URL: 'https://hook.test/old',
      BLUEPRINT_WEBHOOK_SECRET: 'old',
      BLUEPRINT_BOOKING_URL: 'https://book.test/old',
      BLUEPRINT_SAVE_USER_DAILY: '7',
    });
    assert.deepEqual(legacy.webhook, { url: 'https://hook.test/old', secret: 'old' });
    assert.equal(legacy.bookingUrl, 'https://book.test/old');
    assert.equal(legacy.limits.user, 7);

    const current = buildConfig({
      BUILD_WEBHOOK_URL: 'https://hook.test/new',
      BLUEPRINT_WEBHOOK_URL: 'https://hook.test/old',
      BLUEPRINT_WEBHOOK_SECRET: 'old',
      BUILD_SAVE_ANON_DAILY: '5',
      BUILD_MAX_ZIP_BYTES: '2048',
      RESEND_SEGMENT_ID: 'seg_1',
    });
    // The secret pairs with the URL it belongs to.
    assert.deepEqual(current.webhook, { url: 'https://hook.test/new', secret: undefined });
    assert.equal(current.limits.anon, 5);
    assert.equal(current.maxZipBytes, 2048);
    assert.equal(current.segmentId, 'seg_1');
  });

  it('ignores invalid numbers and unsafe URLs', () => {
    const c = buildConfig({ BUILD_MAX_ZIP_BYTES: 'lots', BUILD_SAVE_USER_DAILY: '-1', BUILD_BOOKING_URL: 'http://book.test', NEXT_PUBLIC_BASE_URL: 'javascript:alert(1)' });
    assert.equal(c.maxZipBytes, DEFAULT_MAX_ZIP_BYTES);
    assert.equal(c.limits.user, 10);
    assert.equal(c.bookingUrl, null);
    assert.equal(c.baseUrl, null);
  });

  it('builds links from the configured base URL', () => {
    assert.equal(buildConfig({ NEXT_PUBLIC_BASE_URL: 'https://site.test/' }).baseUrl, 'https://site.test');
    assert.equal(buildLink('https://site.test', 'abc'), 'https://site.test/builds/abc');
    assert.equal(safeBookingUrl('https://book.test/me'), 'https://book.test/me');
    assert.equal(safeBookingUrl(undefined), null);
  });
});
