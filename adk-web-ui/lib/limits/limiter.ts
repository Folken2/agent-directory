/**
 * Daily usage limits as counter rows, one per (key, UTC day).
 *
 * A run *reserves* quota before it starts: the store's conditional increment
 * is atomic, so parallel requests can't all slip past the check. If the
 * backend fails before streaming, the route refunds the reservation.
 * Store errors fail closed: no accounting means no free LLM spend.
 */
import { envInt } from '../env-int';

/** Structurally identical to `Identity` in lib/identity.ts (kept local so this module has no deps). */
type Identity =
  | { kind: 'user'; userId: string }
  | { kind: 'anon'; anonToken: string; ipHash: string | null };

export interface CounterStore {
  /** Increment if below `limit`; false when the bucket is full. */
  tryIncrement(key: string, limit: number, day: string): Promise<boolean>;
  decrement(key: string, day: string): Promise<void>;
}

export type Bucket = { key: string; limit: number };
export type Reservation = { day: string; keys: string[] };
export type LimitUserType = 'authenticated' | 'anonymous';

export type BucketResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: 'limit'; limit: number }
  | { ok: false; reason: 'unavailable' };

export type ReserveRunResult =
  | { allowed: true; reservation: Reservation }
  | { allowed: false; reason: 'limit'; limit: number; userType: LimitUserType }
  | { allowed: false; reason: 'unavailable'; userType: LimitUserType };

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function limitsFromEnv() {
  return {
    user: envInt('RATE_LIMIT_USER_DAILY', 20),
    anon: envInt('RATE_LIMIT_ANON_DAILY', 5),
    anonIp: envInt('RATE_LIMIT_ANON_IP_DAILY', 15),
  };
}

export function bucketsFor(identity: Identity, limits = limitsFromEnv()): Bucket[] {
  if (identity.kind === 'user') {
    return [{ key: `run:u:${identity.userId}`, limit: limits.user }];
  }
  const buckets: Bucket[] = [{ key: `run:a:${identity.anonToken}`, limit: limits.anon }];
  if (identity.ipHash) buckets.push({ key: `run:ip:${identity.ipHash}`, limit: limits.anonIp });
  return buckets;
}

async function releaseKeys(store: CounterStore, keys: string[], day: string): Promise<void> {
  for (const key of keys) {
    try {
      await store.decrement(key, day);
    } catch (error) {
      console.error('[limits] release failed', key, error);
    }
  }
}

export async function reserveBuckets(
  buckets: Bucket[],
  { store, now = new Date() }: { store: CounterStore; now?: Date }
): Promise<BucketResult> {
  const day = utcDay(now);
  const taken: string[] = [];
  try {
    for (const bucket of buckets) {
      const ok = await store.tryIncrement(bucket.key, bucket.limit, day);
      if (!ok) {
        await releaseKeys(store, taken, day);
        return { ok: false, reason: 'limit', limit: bucket.limit };
      }
      taken.push(bucket.key);
    }
    return { ok: true, reservation: { day, keys: taken } };
  } catch (error) {
    console.error('[limits] reserve failed', error);
    await releaseKeys(store, taken, day);
    return { ok: false, reason: 'unavailable' };
  }
}

export function releaseReservation(reservation: Reservation, store: CounterStore): Promise<void> {
  return releaseKeys(store, reservation.keys, reservation.day);
}

export async function reserveRun(
  identity: Identity,
  deps: { store: CounterStore; now?: Date }
): Promise<ReserveRunResult> {
  const userType: LimitUserType = identity.kind === 'user' ? 'authenticated' : 'anonymous';
  const result = await reserveBuckets(bucketsFor(identity), deps);
  if (result.ok) return { allowed: true, reservation: result.reservation };
  if (result.reason === 'limit') return { allowed: false, reason: 'limit', limit: result.limit, userType };
  return { allowed: false, reason: 'unavailable', userType };
}

export function limitMessage(userType: LimitUserType, limit: number): string {
  return userType === 'authenticated'
    ? `You've used all ${limit} runs for today. Your limit resets at midnight UTC.`
    : `You've used all ${limit} free runs for today. Sign in for a higher limit. Limits reset at midnight UTC.`;
}
