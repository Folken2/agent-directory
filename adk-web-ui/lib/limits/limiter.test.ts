import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bucketsFor,
  releaseReservation,
  reserveBuckets,
  reserveRun,
  utcDay,
  type CounterStore,
} from './limiter.ts';

/** In-memory store with the same semantics as the SQL upsert. */
function memoryStore(): CounterStore & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    async tryIncrement(key, limit, day) {
      const k = `${key}|${day}`;
      const current = counts.get(k) ?? 0;
      if (current >= limit) return false;
      counts.set(k, current + 1);
      return true;
    },
    async decrement(key, day) {
      const k = `${key}|${day}`;
      counts.set(k, Math.max((counts.get(k) ?? 0) - 1, 0));
    },
  };
}

const NOW = new Date('2026-10-02T12:00:00Z');
const LIMITS = { user: 20, anon: 5, anonIp: 15 };

describe('utcDay', () => {
  it('formats the UTC date', () => {
    assert.equal(utcDay(new Date('2026-10-02T23:59:59-05:00')), '2026-10-03');
  });
});

describe('bucketsFor', () => {
  it('uses one bucket for signed-in users', () => {
    assert.deepEqual(bucketsFor({ kind: 'user', userId: 'u1' }, LIMITS), [
      { key: 'run:u:u1', limit: 20 },
    ]);
  });
  it('uses token + ip buckets for anonymous users', () => {
    assert.deepEqual(bucketsFor({ kind: 'anon', anonToken: 't1', ipHash: 'h1' }, LIMITS), [
      { key: 'run:a:t1', limit: 5 },
      { key: 'run:ip:h1', limit: 15 },
    ]);
  });
  it('skips the ip bucket when the ip is unknown', () => {
    assert.equal(bucketsFor({ kind: 'anon', anonToken: 't1', ipHash: null }, LIMITS).length, 1);
  });
});

describe('reserveBuckets', () => {
  it('allows up to the limit then blocks', async () => {
    const store = memoryStore();
    const buckets = [{ key: 'k', limit: 2 }];
    assert.equal((await reserveBuckets(buckets, { store, now: NOW })).ok, true);
    assert.equal((await reserveBuckets(buckets, { store, now: NOW })).ok, true);
    const third = await reserveBuckets(buckets, { store, now: NOW });
    assert.deepEqual(third, { ok: false, reason: 'limit', limit: 2 });
  });

  it('rolls back earlier buckets when a later one is full', async () => {
    const store = memoryStore();
    store.counts.set('ip|2026-10-02', 15);
    const r = await reserveBuckets(
      [{ key: 'tok', limit: 5 }, { key: 'ip', limit: 15 }],
      { store, now: NOW }
    );
    assert.deepEqual(r, { ok: false, reason: 'limit', limit: 15 });
    assert.equal(store.counts.get('tok|2026-10-02'), 0);
  });

  it('fails closed and rolls back when the store throws', async () => {
    const store = memoryStore();
    let calls = 0;
    const flaky: CounterStore = {
      async tryIncrement(key, limit, day) {
        calls += 1;
        if (calls === 2) throw new Error('db down');
        return store.tryIncrement(key, limit, day);
      },
      decrement: store.decrement,
    };
    const r = await reserveBuckets(
      [{ key: 'a', limit: 5 }, { key: 'b', limit: 5 }],
      { store: flaky, now: NOW }
    );
    assert.deepEqual(r, { ok: false, reason: 'unavailable' });
    assert.equal(store.counts.get('a|2026-10-02'), 0);
  });

  it('refund returns quota', async () => {
    const store = memoryStore();
    const r = await reserveBuckets([{ key: 'k', limit: 1 }], { store, now: NOW });
    assert.ok(r.ok);
    await releaseReservation(r.reservation, store);
    assert.equal((await reserveBuckets([{ key: 'k', limit: 1 }], { store, now: NOW })).ok, true);
  });
});

describe('reserveRun', () => {
  it('blocks a cookie-clearing anonymous user via the ip bucket', async () => {
    const store = memoryStore();
    process.env.RATE_LIMIT_ANON_DAILY = '5';
    process.env.RATE_LIMIT_ANON_IP_DAILY = '6';
    let allowed = 0;
    // Every request arrives with a brand-new token (cookie cleared) but the same IP.
    for (let i = 0; i < 10; i += 1) {
      const r = await reserveRun(
        { kind: 'anon', anonToken: `t${i}`, ipHash: 'same-ip' },
        { store, now: NOW }
      );
      if (r.allowed) allowed += 1;
    }
    assert.equal(allowed, 6);
    delete process.env.RATE_LIMIT_ANON_DAILY;
    delete process.env.RATE_LIMIT_ANON_IP_DAILY;
  });

  it('labels the user type on denial', async () => {
    const store = memoryStore();
    store.counts.set('run:u:u1|2026-10-02', 20);
    const r = await reserveRun({ kind: 'user', userId: 'u1' }, { store, now: NOW });
    assert.deepEqual(r, { allowed: false, reason: 'limit', limit: 20, userType: 'authenticated' });
  });
});
