import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeBookingUrl, saveSubmission, submissionBuckets, validateSubmission } from './submission.ts';
import { notifyOwner } from './notify.ts';

const blueprint = { name: 'Bp', goal: 'G', agents: [{ name: 'a', role: 'r' }] };
const body = { email: ' Me@Example.com ', consent: true, blueprint, sessionId: 'session-123' };

describe('validateSubmission', () => {
  it('normalizes a valid body', () => {
    const r = validateSubmission(body);
    assert.ok(r.ok);
    assert.equal(r.value.email, 'me@example.com');
    assert.equal(r.value.sessionId, 'session-123');
    assert.equal(r.value.blueprint.agents[0].kind, 'llm');
  });
  it('requires explicit consent', () => {
    assert.deepEqual(validateSubmission({ ...body, consent: false }), { ok: false, reason: 'consent' });
    assert.deepEqual(validateSubmission({ ...body, consent: 'yes' }), { ok: false, reason: 'consent' });
  });
  it('rejects bad email, blueprint and session id', () => {
    assert.deepEqual(validateSubmission({ ...body, email: 'nope' }), { ok: false, reason: 'email' });
    assert.deepEqual(validateSubmission({ ...body, email: `${'a'.repeat(250)}@x.io` }), { ok: false, reason: 'email' });
    assert.deepEqual(validateSubmission({ ...body, blueprint: { name: 'x' } }), { ok: false, reason: 'blueprint' });
    assert.deepEqual(validateSubmission({ ...body, sessionId: '../x' }), { ok: false, reason: 'session' });
    assert.deepEqual(validateSubmission(null), { ok: false, reason: 'body' });
  });
});

describe('submissionBuckets', () => {
  it('limits users and anonymous visitors separately', () => {
    assert.deepEqual(submissionBuckets({ kind: 'user', userId: 'u1' }).map((b) => b.key), ['bp:u:u1']);
    assert.deepEqual(
      submissionBuckets({ kind: 'anon', anonToken: 'tok', ipHash: 'ip' }).map((b) => b.key),
      ['bp:a:tok', 'bp:ip:ip'],
    );
  });
});

describe('safeBookingUrl', () => {
  it('only allows https', () => {
    assert.equal(safeBookingUrl('https://cal.example.com/me'), 'https://cal.example.com/me');
    assert.equal(safeBookingUrl('javascript:alert(1)'), null);
    assert.equal(safeBookingUrl('http://x.io'), null);
    assert.equal(safeBookingUrl(undefined), null);
  });
});

function validInput() {
  const r = validateSubmission(body);
  if (!r.ok) throw new Error('fixture invalid');
  return r.value;
}

describe('saveSubmission', () => {
  const input = validInput();
  const now = () => new Date('2026-10-03T10:00:00Z');

  it('stores with consent time and user id, then notifies', async () => {
    const stored: unknown[] = [];
    const notified: unknown[] = [];
    const r = await saveSubmission(input, { kind: 'user', userId: 'u1' }, {
      store: async (rec) => (stored.push(rec), { id: 'id-1' }),
      notify: async (rec) => void notified.push(rec),
      now,
    });
    assert.deepEqual(r, { id: 'id-1', notified: true });
    assert.equal((stored[0] as { userId: string }).userId, 'u1');
    assert.equal((stored[0] as { consentAt: Date }).consentAt.toISOString(), '2026-10-03T10:00:00.000Z');
    assert.equal((notified[0] as { id: string }).id, 'id-1');
  });

  it('a failed notification does not fail the save', async () => {
    const r = await saveSubmission(input, { kind: 'anon', anonToken: 't', ipHash: null }, {
      store: async () => ({ id: 'id-2' }),
      notify: async () => {
        throw new Error('down');
      },
      now,
    });
    assert.deepEqual(r, { id: 'id-2', notified: false });
  });

  it('propagates storage failures', async () => {
    await assert.rejects(
      saveSubmission(input, { kind: 'anon', anonToken: 't', ipHash: null }, {
        store: async () => {
          throw new Error('db');
        },
        notify: async () => {},
      }),
    );
  });
});

describe('notifyOwner', () => {
  const record = {
    email: 'me@example.com',
    blueprint: validInput().blueprint,
    sessionId: null,
    userId: null,
    consentAt: new Date('2026-10-03T10:00:00Z'),
    id: 'id-1',
  };

  it('is a no-op without a webhook url', async () => {
    let called = false;
    await notifyOwner(record, {}, (async () => ((called = true), new Response())) as typeof fetch);
    assert.equal(called, false);
  });

  it('posts JSON with the bearer secret and throws on non-2xx', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const ok = (async (url: string, init: RequestInit) => (calls.push({ url, init }), new Response('ok'))) as unknown as typeof fetch;
    await notifyOwner(record, { url: 'https://hooks.example.com/x', secret: 's3' }, ok);
    assert.equal(calls[0].url, 'https://hooks.example.com/x');
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer s3');
    const payload = JSON.parse(String(calls[0].init.body));
    assert.equal(payload.type, 'blueprint.saved');
    assert.ok(payload.markdown.includes('# Bp'));

    const fail = (async () => new Response('no', { status: 500 })) as typeof fetch;
    await assert.rejects(notifyOwner(record, { url: 'https://hooks.example.com/x' }, fail));
  });
});
