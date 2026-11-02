/**
 * Signed hand-off from middleware to /api/analytics/pageview.
 *
 * The middleware self-fetch leaves from Vercel's network, and Vercel overwrites
 * `x-forwarded-for`, `x-real-ip` and the `x-vercel-ip-*` geo headers on every
 * inbound request. Without this, the server hit is hashed and rate-limited as
 * Vercel's egress IP. Middleware therefore sends the visitor's IP and geo in
 * its own headers, signed with a shared secret; the route trusts them only when
 * the signature checks out. Web Crypto only: runs in edge middleware and Node.
 */

export const INGEST_SIGNATURE_HEADER = 'x-analytics-ingest';
export const INGEST_IP_HEADER = 'x-analytics-client-ip';
export const INGEST_COUNTRY_HEADER = 'x-analytics-country';
export const INGEST_REGION_HEADER = 'x-analytics-region';
export const INGEST_CITY_HEADER = 'x-analytics-city';

/** How old a signature may be. Middleware and route share a clock, so this is generous. */
const MAX_AGE_MS = 5 * 60 * 1000;

export type ForwardedClient = {
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
};

/** ANALYTICS_INGEST_SECRET, or a key derived from AUTH_SECRET so it works before that is set. */
export function ingestSecret(env: Record<string, string | undefined> = process.env): string | null {
  if (env.ANALYTICS_INGEST_SECRET) return env.ANALYTICS_INGEST_SECRET;
  const auth = env.AUTH_SECRET || env.NEXTAUTH_SECRET;
  return auth ? `derived:analytics-ingest:${auth}` : null;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

function canonical(ts: number, client: ForwardedClient): string {
  return [ts, client.ip ?? '', client.country ?? '', client.region ?? '', client.city ?? ''].join('\n');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Headers middleware adds to its self-fetch. Empty when no secret is configured. */
export async function signForwardedClient(
  client: ForwardedClient,
  secret: string | null = ingestSecret(),
  now: number = Date.now()
): Promise<Record<string, string>> {
  if (!secret) return {};
  const signature = await hmacHex(secret, canonical(now, client));
  return {
    [INGEST_SIGNATURE_HEADER]: `${now}.${signature}`,
    [INGEST_IP_HEADER]: client.ip ?? '',
    [INGEST_COUNTRY_HEADER]: client.country ?? '',
    [INGEST_REGION_HEADER]: client.region ?? '',
    [INGEST_CITY_HEADER]: client.city ?? '',
  };
}

/**
 * The visitor IP and geo middleware vouched for, or null when the request is
 * not a correctly signed internal hit (then the caller uses its own headers).
 */
export async function verifyForwardedClient(
  headers: Headers,
  secret: string | null = ingestSecret(),
  now: number = Date.now()
): Promise<ForwardedClient | null> {
  const raw = headers.get(INGEST_SIGNATURE_HEADER);
  if (!raw || !secret) return null;
  const dot = raw.indexOf('.');
  const ts = Number(raw.slice(0, dot));
  const signature = raw.slice(dot + 1);
  if (dot <= 0 || !Number.isFinite(ts) || Math.abs(now - ts) > MAX_AGE_MS) return null;

  const client: ForwardedClient = {
    ip: headers.get(INGEST_IP_HEADER) || null,
    country: headers.get(INGEST_COUNTRY_HEADER) || null,
    region: headers.get(INGEST_REGION_HEADER) || null,
    city: headers.get(INGEST_CITY_HEADER) || null,
  };
  const expected = await hmacHex(secret, canonical(ts, client));
  return timingSafeEqual(signature, expected) ? client : null;
}
