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

export function hashIp(
  ip: string | null | undefined,
  salt: string = getIpHashSalt()
): string | null {
  if (!ip || !ip.trim()) return null;
  return createHmac('sha256', salt).update(ip.trim()).digest('hex');
}

export function extractClientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  return headers.get('x-real-ip')?.trim() || null;
}
