import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiErrorBody,
  ChatApiError,
  errorFromResponse,
  friendlyMessage,
  isApiErrorCode,
  newRequestId,
} from './api-error.ts';

describe('friendlyMessage', () => {
  it('maps known codes and falls back to internal', () => {
    assert.match(friendlyMessage('backend_unavailable'), /waking up/);
    assert.equal(friendlyMessage('nope'), friendlyMessage('internal'));
    assert.equal(isApiErrorCode('idle_timeout'), true);
    assert.equal(isApiErrorCode('toString'), false);
  });
});

describe('apiErrorBody', () => {
  it('builds the wire shape with friendly default copy', () => {
    const body = apiErrorBody('invalid_input', 'req-1');
    assert.deepEqual(body, {
      success: false,
      code: 'invalid_input',
      error: friendlyMessage('invalid_input'),
      requestId: 'req-1',
    });
  });
  it('includes rateLimit only when given', () => {
    const rl = { exceeded: true as const, count: 5, limit: 5, userType: 'anonymous' as const };
    assert.deepEqual(apiErrorBody('rate_limited', 'r', { rateLimit: rl }).rateLimit, rl);
  });
});

describe('newRequestId', () => {
  it('returns distinct uuids', () => {
    assert.notEqual(newRequestId(), newRequestId());
  });
});

describe('errorFromResponse', () => {
  it('reads code, message, requestId and rateLimit from a typed body', async () => {
    const res = new Response(
      JSON.stringify({ success: false, code: 'rate_limited', error: 'limit hit', requestId: 'r9', rateLimit: { exceeded: true, count: 5, limit: 5, userType: 'anonymous' } }),
      { status: 429 }
    );
    const err = await errorFromResponse(res);
    assert.ok(err instanceof ChatApiError);
    assert.equal(err.code, 'rate_limited');
    assert.equal(err.status, 429);
    assert.equal(err.message, 'limit hit');
    assert.equal(err.requestId, 'r9');
    assert.equal(err.rateLimit?.limit, 5);
  });
  it('derives a code from status when the body is not JSON', async () => {
    const err = await errorFromResponse(new Response('<html>bad gateway</html>', { status: 502 }));
    assert.equal(err.code, 'backend_unavailable');
    assert.equal(err.message, friendlyMessage('backend_unavailable'));
  });
});
