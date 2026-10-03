import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Breadcrumb, Event } from '@sentry/nextjs';
import { redactUrl, scrubBreadcrumb, scrubEvent, scrubSpan } from './sentry-scrub.ts';

const TOKEN = 'a'.repeat(64);
const SESSION_URL = `http://backend:8000/apps/demo/users/a_${TOKEN}/sessions/s1?x=1`;

describe('redactUrl', () => {
  it('redacts the user path segment', () => {
    assert.equal(
      redactUrl(SESSION_URL),
      'http://backend:8000/apps/demo/users/[redacted]/sessions/s1?x=1',
    );
  });

  it('redacts limiter keys', () => {
    assert.equal(redactUrl(`limit run:a:${TOKEN} failed`), 'limit run:[redacted] failed');
    assert.equal(redactUrl('limit run:u:user-123 failed'), 'limit run:[redacted] failed');
    assert.equal(redactUrl('limit run:ip:deadbeef01'), 'limit run:[redacted]');
  });

  it('leaves unrelated strings alone', () => {
    assert.equal(redactUrl('/api/agents?page=2'), '/api/agents?page=2');
  });
});

describe('scrubEvent', () => {
  it('removes body, cookies and auth headers and redacts urls', () => {
    const event = {
      transaction: `GET /apps/demo/users/a_${TOKEN}/sessions`,
      request: {
        url: SESSION_URL,
        query_string: `next=/users/a_${TOKEN}/x`,
        data: '{"new_message":"SECRET"}',
        cookies: { 'authjs.session-token': 'SECRET' },
        headers: {
          Cookie: 'authjs.session-token=SECRET',
          AUTHORIZATION: 'Bearer SECRET',
          'user-agent': 'test',
        },
      },
      spans: [
        { description: `GET ${SESSION_URL}`, data: { 'url.full': SESSION_URL, 'http.method': 'GET' } },
      ],
      breadcrumbs: [
        { category: 'console', message: 'SECRET' },
        { category: 'http', data: { url: SESSION_URL } },
      ],
    } as unknown as Event;

    const out = scrubEvent(event);
    const json = JSON.stringify(out);
    assert.ok(!json.includes('SECRET'), json);
    assert.ok(!json.includes(TOKEN), json);
    assert.equal(out.request?.headers?.['user-agent'], 'test');
    assert.equal(out.request?.url, 'http://backend:8000/apps/demo/users/[redacted]/sessions/s1?x=1');
    assert.equal(out.breadcrumbs?.length, 1);
    assert.equal(out.transaction, 'GET /apps/demo/users/[redacted]/sessions');
  });

  it('leaves an event without request unchanged', () => {
    const event = { message: 'hello', level: 'error' } as unknown as Event;
    const before = structuredClone(event);
    assert.deepEqual(scrubEvent(event), before);
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs', () => {
    assert.equal(scrubBreadcrumb({ category: 'console', message: 'x' }), null);
  });

  it('redacts url and message', () => {
    const b: Breadcrumb = {
      category: 'http',
      message: `GET ${SESSION_URL}`,
      data: { url: SESSION_URL, status_code: 200 },
    };
    const out = scrubBreadcrumb(b);
    assert.ok(out);
    assert.ok(!JSON.stringify(out).includes(TOKEN));
    assert.equal(out.data?.status_code, 200);
  });
});

describe('scrubSpan', () => {
  it('redacts description and url attributes', () => {
    const span = {
      description: `POST ${SESSION_URL}`,
      data: {
        url: SESSION_URL,
        'url.full': SESSION_URL,
        'http.url': SESSION_URL,
        'http.target': `/apps/demo/users/a_${TOKEN}/sessions`,
        'url.path': `/apps/demo/users/a_${TOKEN}/sessions`,
        'http.method': 'POST',
      },
    };
    const out = scrubSpan(span);
    assert.ok(!JSON.stringify(out).includes(TOKEN));
    assert.equal(out.data['http.method'], 'POST');
  });
});

describe('blueprint save scrubbing', () => {
  it('redacts blueprint limiter keys and email addresses', () => {
    const out = redactUrl(`limit bp:a:${TOKEN} bp:u:user-1 for Someone.Name+tag@example.co.uk`);
    assert.ok(!out.includes(TOKEN));
    assert.ok(!out.includes('user-1'));
    assert.ok(!out.includes('example.co.uk'));
    assert.match(out, /bp:\[redacted\]/);
    assert.match(out, /\[email\]/);
  });
});
