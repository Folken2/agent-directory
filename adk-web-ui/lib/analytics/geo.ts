/**
 * Visitor geo without depending on the host. Headers first (Cloudflare,
 * Vercel), then an in-process lookup on the raw IP *before* hashing. The raw
 * IP is never stored.
 */
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
  if (!ip) return EMPTY;
  try {
    return (await lookup(ip)) ?? EMPTY;
  } catch (error) {
    console.error('[geo] lookup failed', error);
    return EMPTY;
  }
}
