import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isConsentOnlyEvent,
  isFunnelEvent,
  parseEngagementBody,
} from './engagement-input.ts';

describe('event kinds', () => {
  it('separates consent-only events from funnel clicks', () => {
    assert.equal(isConsentOnlyEvent('heartbeat'), true);
    assert.equal(isConsentOnlyEvent('try_agent'), false);
    assert.equal(isFunnelEvent('contact_github'), true);
    assert.equal(isFunnelEvent('contact_'), false);
    assert.equal(isFunnelEvent('drop_table'), false);
  });
});

describe('parseEngagementBody', () => {
  it('rejects non-objects and unknown events', () => {
    assert.deepEqual(parseEngagementBody(null), { ok: false, error: 'invalid_json' });
    assert.deepEqual(parseEngagementBody([]), { ok: false, error: 'invalid_json' });
    assert.deepEqual(parseEngagementBody({ eventType: 'nope' }), { ok: false, error: 'invalid_event' });
  });

  it('cleans fields and adds landing and visit to metadata', () => {
    const res = parseEngagementBody({
      eventType: 'try_agent',
      agentSlug: 'web_search',
      path: '/guides/adk?x=1',
      landing: '/guides/adk',
      visit: '0b9f7c1e-1234-4abc-9def-001122334455',
      durationMs: 5,
      metadata: { placement: 'hero' },
    });
    assert.ok(res.ok);
    assert.equal(res.value.path, '/guides/adk');
    assert.equal(res.value.agentSlug, 'web_search');
    assert.deepEqual(res.value.metadata, {
      placement: 'hero',
      landing: '/guides/adk',
      visit: '0b9f7c1e-1234-4abc-9def-001122334455',
    });
  });

  it('drops bad optional fields instead of storing them', () => {
    const res = parseEngagementBody(
      {
        eventType: 'heartbeat',
        agentSlug: "x'; drop table",
        path: 'https://evil.example/',
        landing: '//evil.example',
        visit: '<script>',
        durationMs: 10 * 60 * 1000 + 1,
        sessionKey: 'k'.repeat(101),
      },
      '/chat'
    );
    assert.ok(res.ok);
    assert.equal(res.value.agentSlug, null);
    assert.equal(res.value.path, '/chat');
    assert.equal(res.value.durationMs, null);
    assert.equal(res.value.sessionKey, null);
    assert.equal(res.value.metadata, null);
  });

  it('caps metadata size, key count and value types', () => {
    const tooMany = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, 1]));
    assert.deepEqual(parseEngagementBody({ eventType: 'copy_page', metadata: tooMany }), {
      ok: false,
      error: 'metadata_too_large',
    });
    const big = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`k${i}`, 'x'.repeat(200)]));
    assert.deepEqual(parseEngagementBody({ eventType: 'copy_page', metadata: big }), {
      ok: false,
      error: 'metadata_too_large',
    });
    assert.deepEqual(parseEngagementBody({ eventType: 'copy_page', metadata: { nested: { a: 1 } } }), {
      ok: false,
      error: 'invalid_metadata',
    });
    assert.deepEqual(parseEngagementBody({ eventType: 'copy_page', metadata: { 'Bad-Key': 1 } }), {
      ok: false,
      error: 'invalid_metadata',
    });
    const long = parseEngagementBody({ eventType: 'copy_page', metadata: { slug: 'y'.repeat(500) } });
    assert.ok(long.ok);
    assert.equal(String(long.value.metadata?.slug).length, 200);
  });
});
