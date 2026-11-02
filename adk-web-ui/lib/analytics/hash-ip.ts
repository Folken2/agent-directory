import { createHmac } from 'crypto';

/**
 * HMAC-SHA256 of the IP. Never persist the raw address.
 * Salt prefers ANALYTICS_IP_SALT, then AUTH_SECRET / NEXTAUTH_SECRET.
 */
export function getIpHashSalt(): string {
  return (
    process.env.ANALYTICS_IP_SALT ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'dev-analytics-ip-salt'
  );
}

/** The UTC day the hash key belongs to, as YYYY-MM-DD. */
export function ipHashDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The key rotates every UTC day: HMAC(secret, day). The same IP hashes to a
 * different value tomorrow, so stored hashes cannot be linked across days and
 * the key for a past day is never kept. Every IP-keyed limit is a UTC-day
 * bucket, so rotation never splits a bucket.
 */
export function hashIp(
  ip: string | null | undefined,
  salt: string = getIpHashSalt(),
  now: Date = new Date()
): string | null {
  if (!ip || !ip.trim()) return null;
  const dayKey = createHmac('sha256', salt).update(`ip-hash:${ipHashDay(now)}`).digest();
  return createHmac('sha256', dayKey).update(ip.trim()).digest('hex');
}

export { extractClientIp } from './client-ip';
