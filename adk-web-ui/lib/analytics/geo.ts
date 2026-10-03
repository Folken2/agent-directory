/**
 * Visitor geo without depending on the host. Headers first (Cloudflare,
 * Vercel), then an in-process lookup on the raw IP *before* hashing. The raw
 * IP is never stored.
 */
import { isIPv4 } from 'node:net';

export type Geo = { country: string | null; region: string | null; city: string | null };

const EMPTY: Geo = { country: null, region: null, city: null };

export function geoFromHeaders(h: Headers): Geo | null {
  const cf = h.get('cf-ipcountry');
  if (cf && cf !== 'XX' && cf !== 'T1') return { country: cf, region: null, city: null };
  const vercel = h.get('x-vercel-ip-country');
  if (vercel) {
    return {
      country: vercel,
      region: h.get('x-vercel-ip-country-region'),
      city: h.get('x-vercel-ip-city'),
    };
  }
  return null;
}

/**
 * The IPv4 address worth geolocating, or null. fast-geoip only covers IPv4
 * and would mislabel IPv6, private and reserved addresses.
 */
export function lookupableIpv4(ip: string): string | null {
  const v4 = ip.toLowerCase().startsWith('::ffff:') ? ip.slice(7) : ip;
  if (!isIPv4(v4)) return null;
  const [a, b] = v4.split('.').map(Number);
  if (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  ) {
    return null;
  }
  return v4;
}

async function fastGeoipLookup(ip: string): Promise<Geo | null> {
  const { default: geoip } = await import('fast-geoip');
  const hit = await geoip.lookup(ip);
  if (!hit) return null;
  return { country: hit.country || null, region: hit.region || null, city: hit.city || null };
}

export async function resolveGeo(
  h: Headers,
  ip: string | null,
  lookup: (ip: string) => Promise<Geo | null> = fastGeoipLookup
): Promise<Geo> {
  const fromHeaders = geoFromHeaders(h);
  if (fromHeaders) return fromHeaders;
  const v4 = ip ? lookupableIpv4(ip) : null;
  if (!v4) return EMPTY;
  try {
    return (await lookup(v4)) ?? EMPTY;
  } catch (error) {
    console.error('[geo] lookup failed', error);
    return EMPTY;
  }
}
