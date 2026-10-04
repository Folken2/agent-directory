import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleSaveBuild, type SaveBuildDeps } from './save-handler.ts';
import { buildConfig } from './config.ts';
import { BUILD } from './test-fixtures.ts';
import type { NewBuildSave } from './types.ts';
import type { SendLinkArgs } from './sender.ts';
import type { OwnerNotification } from './notify.ts';

const ZIP = Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
const TOKEN = 't'.repeat(43);
const body = { email: ' Me@Example.com ', sessionId: 'session-123', updates: false, help: false };

function setup(over: Partial<SaveBuildDeps> = {}, env: Record<string, string> = {}) {
  const calls = {
    loaded: 0,
    released: 0,
    inserted: [] as NewBuildSave[],
    sent: [] as SendLinkArgs[],
    emailSent: [] as string[],
    contacts: [] as string[],
    notified: [] as OwnerNotification[],
    markedNotified: [] as string[],
    deleted: [] as string[],
    fetched: 0,
    reserved: 0,
    resolved: 0,
  };
  const deps: SaveBuildDeps = {
    config: buildConfig({ NEXT_PUBLIC_BASE_URL: 'https://site.test', ...env }),
    origin: 'http://localhost:3000',
    dbEnabled: () => true,
    resolveIdentity: async () => (calls.resolved++, { identity: { kind: 'anon', anonToken: 'a'.repeat(64), ipHash: 'ip' }, newAnonToken: null }),
    adkUserId: async (identity) => (identity.kind === 'user' ? `u_${identity.userId}` : `a_${identity.anonToken}`),
    reserve: async () => (calls.reserved++, { ok: true, reservation: { day: '2026-10-04', keys: ['bd:a:x'] } }),
    release: async () => {
      calls.released++;
    },
    loadBuild: async () => {
      calls.loaded++;
      return { kind: 'ok', build: BUILD };
    },
    fetchZip: async () => (calls.fetched++, { kind: 'ok', bytes: ZIP }),
    store: {
      insert: async (r) => (calls.inserted.push(r), { id: 'save-1' }),
      markEmailSent: async (id) => void calls.emailSent.push(id),
      markNotified: async (id) => void calls.markedNotified.push(id),
      delete: async (id) => void calls.deleted.push(id),
    },
    newToken: () => ({ token: TOKEN, hash: 'h'.repeat(64) }),
    sendLink: async (a) => (calls.sent.push(a), { kind: 'sent', emailId: 'em_1' }),
    addContact: async (email) => void calls.contacts.push(email),
    notify: async (n) => (calls.notified.push(n), true),
    now: () => new Date('2026-10-04T10:00:00Z'),
    log: { warn() {}, error() {} },
    ...over,
  };
  return { deps, calls };
}

describe('handleSaveBuild', () => {
  it('stores the zip from the session and emails the link', async () => {
    const { deps, calls } = setup();
    const r = await handleSaveBuild(body, deps);
    assert.ok(r.ok);
    assert.deepEqual(r.data, { id: 'save-1', sent: true });
    assert.equal(calls.inserted.length, 1);
    const row = calls.inserted[0];
    assert.equal(row.email, 'me@example.com');
    assert.equal(row.tokenHash, 'h'.repeat(64));
    assert.equal(row.userId, null);
    assert.equal(row.sessionId, 'session-123');
    assert.equal(row.build, BUILD);
    assert.deepEqual(row.zip, ZIP);
    assert.equal(row.updatesConsentAt, null);
    assert.equal(row.helpRequested, false);
    assert.equal(calls.sent[0].link, `https://site.test/builds/${TOKEN}`);
    assert.equal(calls.sent[0].to, 'me@example.com');
    assert.equal(calls.sent[0].message.subject, 'Your agent: research-summarizer');
    assert.deepEqual(calls.emailSent, ['save-1']);
    assert.deepEqual(calls.markedNotified, ['save-1']);
    assert.equal(calls.released, 0);
  });

  it('does not call the contacts API without updates, and does with it', async () => {
    const off = setup();
    await handleSaveBuild(body, off.deps);
    assert.deepEqual(off.calls.contacts, []);

    const on = setup();
    await handleSaveBuild({ ...body, updates: true }, on.deps);
    assert.deepEqual(on.calls.contacts, ['me@example.com']);
    assert.equal(on.calls.inserted[0].updatesConsentAt?.toISOString(), '2026-10-04T10:00:00.000Z');
  });

  it('returns the booking link only when help was asked for', async () => {
    const env = { BUILD_BOOKING_URL: 'https://book.test/me' };
    const without = await handleSaveBuild(body, setup({}, env).deps);
    assert.ok(without.ok && !('bookingUrl' in without.data));
    const withHelp = setup({}, env);
    const r = await handleSaveBuild({ ...body, help: true }, withHelp.deps);
    assert.ok(r.ok);
    assert.equal(r.data.bookingUrl, 'https://book.test/me');
    assert.equal(withHelp.calls.inserted[0].helpRequested, true);
    assert.equal(withHelp.calls.notified[0].help, true);
  });

  it('404s when the session has no build', async () => {
    const { deps, calls } = setup({ loadBuild: async () => ({ kind: 'missing' }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'not_found');
    assert.equal(calls.released, 1);
    assert.equal(calls.inserted.length, 0);
  });

  it('410s when the artifact is gone', async () => {
    const { deps, calls } = setup({ fetchZip: async () => ({ kind: 'gone' }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'gone');
    assert.match(r.message ?? '', /package it again/);
    assert.equal(calls.released, 1);
    assert.equal(calls.inserted.length, 0);
  });

  it('rejects zips over BUILD_MAX_ZIP_BYTES', async () => {
    const { deps, calls } = setup({}, { BUILD_MAX_ZIP_BYTES: '10' });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_input');
    assert.match(r.message ?? '', /too large/);
    assert.equal(calls.released, 1);
    assert.equal(calls.fetched, 0);
  });

  it('stops at the daily limit before touching ADK', async () => {
    const { deps, calls } = setup({ reserve: async () => ({ ok: false, reason: 'limit', limit: 3 }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'rate_limited');
    assert.equal(calls.loaded, 0);
    assert.ok(r.resolved, 'identity is returned so the route can set the cookie');
  });

  it('deletes the row, releases the reservation and asks to retry when sending fails', async () => {
    const { deps, calls } = setup({ sendLink: async () => ({ kind: 'failed', reason: 'validation_error' }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'temporarily_unavailable');
    assert.match(r.message ?? '', /couldn't send/i);
    assert.equal(calls.inserted.length, 1);
    assert.deepEqual(calls.deleted, ['save-1']);
    assert.deepEqual(calls.emailSent, []);
    assert.equal(calls.released, 1);
  });

  it('still returns the send-failed error when deleting the unsent row throws', async () => {
    const { deps, calls } = setup({ sendLink: async () => ({ kind: 'failed', reason: 'x' }) });
    deps.store.delete = async () => {
      throw new Error('db');
    };
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'temporarily_unavailable');
    assert.match(r.message ?? '', /couldn't send/i);
    assert.equal(calls.released, 1);
  });

  it('returns the link in dev mode and uses the request origin without NEXT_PUBLIC_BASE_URL', async () => {
    const { deps, calls } = setup({ config: buildConfig({}), sendLink: async () => ({ kind: 'dev' }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(r.ok);
    assert.deepEqual(r.data, { id: 'save-1', sent: false, link: `http://localhost:3000/builds/${TOKEN}` });
    assert.deepEqual(calls.emailSent, []);
  });

  it('a failed owner notification does not fail the request', async () => {
    const { deps, calls } = setup({ notify: async () => { throw new Error('down'); } });
    const r = await handleSaveBuild(body, deps);
    assert.ok(r.ok);
    assert.deepEqual(calls.markedNotified, []);
  });

  it('records the signed-in user', async () => {
    const { deps, calls } = setup({ resolveIdentity: async () => ({ identity: { kind: 'user', userId: 'u1' }, newAnonToken: null }) });
    await handleSaveBuild(body, deps);
    assert.equal(calls.inserted[0].userId, 'u1');
    assert.equal(calls.notified[0].signedIn, true);
  });

  it('validates before anything else, then needs a database', async () => {
    const bad = setup();
    const r = await handleSaveBuild({ ...body, email: 'nope' }, bad.deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_input');
    assert.match(r.message ?? '', /valid email/);
    assert.equal(r.resolved, null);

    const noDbSetup = setup({ dbEnabled: () => false });
    const noDb = await handleSaveBuild(body, noDbSetup.deps);
    assert.equal(noDbSetup.calls.reserved, 0);
    assert.equal(noDbSetup.calls.resolved, 0);
    assert.ok(!noDb.ok);
    assert.equal(noDb.code, 'temporarily_unavailable');
  });

  it('releases the reservation when storage fails', async () => {
    const { deps, calls } = setup({
      store: {
        insert: async () => { throw new Error('db'); },
        markEmailSent: async () => {},
        markNotified: async () => {},
        delete: async () => {},
      },
    });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'internal');
    assert.equal(calls.released, 1);
    assert.equal(calls.sent.length, 0);
  });

  it('rejects a fetched zip over BUILD_MAX_ZIP_BYTES even when build.bytes is small', async () => {
    const { deps, calls } = setup(
      { loadBuild: async () => ({ kind: 'ok', build: { ...BUILD, bytes: 1 } }) },
      { BUILD_MAX_ZIP_BYTES: String(ZIP.length - 1) },
    );
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_input');
    assert.match(r.message ?? '', /too large/);
    assert.equal(calls.released, 1);
    assert.equal(calls.inserted.length, 0);
  });

  it('reads the session with the server-resolved ADK user id, ignoring any id in the body', async () => {
    const seen: string[] = [];
    const { deps } = setup({
      loadBuild: async (uid) => (seen.push(`load:${uid}`), { kind: 'ok', build: BUILD }),
      fetchZip: async (uid) => (seen.push(`zip:${uid}`), { kind: 'ok', bytes: ZIP }),
    });
    const evil = { ...body, adkUserId: 'victim', userId: 'victim' };
    const r = await handleSaveBuild(evil, deps);
    assert.ok(r.ok);
    const expected = `a_${'a'.repeat(64)}`;
    assert.deepEqual(seen, [`load:${expected}`, `zip:${expected}`]);
  });
});
