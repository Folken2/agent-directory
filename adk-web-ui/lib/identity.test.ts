import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adkUserIdForSession,
  ANON_COOKIE_NAME,
  applyIdentityCookie,
  defaultAdkUserId,
  identityKey,
  resolveIdentityWith,
  type IdentityDeps,
} from './identity.ts';

const TOKEN = 'a'.repeat(64);

function deps(over: Partial<IdentityDeps> = {}): IdentityDeps {
  return {
    getUserId: async () => null,
    readCookie: () => undefined,
    ipHash: () => 'iphash',
    mintToken: () => 'b'.repeat(64),
    ...over,
  };
}

describe('resolveIdentityWith', () => {
  it('prefers the signed-in user', async () => {
    const r = await resolveIdentityWith(deps({ getUserId: async () => 'user-1' }));
    assert.deepEqual(r, { identity: { kind: 'user', userId: 'user-1' }, newAnonToken: null });
  });

  it('reuses a valid anonymous cookie without minting', async () => {
    const r = await resolveIdentityWith(deps({ readCookie: () => TOKEN }));
    assert.deepEqual(r.identity, { kind: 'anon', anonToken: TOKEN, ipHash: 'iphash' });
    assert.equal(r.newAnonToken, null);
  });

  it('mints a token for a new visitor and for malformed cookies', async () => {
    for (const cookie of [undefined, 'not-hex', 'A'.repeat(64)]) {
      const r = await resolveIdentityWith(deps({ readCookie: () => cookie }));
      assert.equal(r.newAnonToken, 'b'.repeat(64));
      assert.equal(r.identity.kind, 'anon');
    }
  });

  it('treats an auth lookup failure as anonymous', async () => {
    const r = await resolveIdentityWith(
      deps({ getUserId: async () => { throw new Error('db'); } })
    );
    assert.equal(r.identity.kind, 'anon');
  });
});

describe('applyIdentityCookie (regression: cookie was only set on 429)', () => {
  it('sets the anon cookie on a successful streaming response', async () => {
    const resolved = await resolveIdentityWith(deps());
    const res = new Response('data: {}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    applyIdentityCookie(res, resolved, true);
    const cookie = res.headers.get('set-cookie') ?? '';
    assert.match(cookie, new RegExp(`^${ANON_COOKIE_NAME}=${'b'.repeat(64)};`));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /Max-Age=31536000/);
  });

  it('sets nothing when no token was minted', async () => {
    const resolved = await resolveIdentityWith(deps({ readCookie: () => TOKEN }));
    const res = new Response('ok');
    applyIdentityCookie(res, resolved, true);
    assert.equal(res.headers.get('set-cookie'), null);
  });
});

describe('ADK user ids', () => {
  const user = { kind: 'user' as const, userId: 'user-1' };
  const anon = { kind: 'anon' as const, anonToken: TOKEN, ipHash: null };

  it('derives per-identity ids and keys', () => {
    assert.equal(defaultAdkUserId(user), 'u_user-1');
    assert.equal(defaultAdkUserId(anon), `a_${TOKEN}`);
    assert.equal(identityKey(user), 'user-1');
    assert.equal(identityKey(anon), TOKEN);
  });

  it('keeps a legacy id only when the identity owns that session', async () => {
    const owned = async (key: string, sid: string) =>
      key === 'user-1' && sid === 'session-old' ? 'default-user' : null;
    assert.equal(await adkUserIdForSession(user, 'session-old', owned), 'default-user');
    assert.equal(await adkUserIdForSession(user, 'session-new', owned), 'u_user-1');
  });

  it('falls back to the derived id when the lookup fails', async () => {
    const boom = async () => { throw new Error('db'); };
    assert.equal(await adkUserIdForSession(user, 's', boom), 'u_user-1');
  });
});
