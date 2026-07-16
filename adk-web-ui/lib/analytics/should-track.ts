const SKIP_PREFIXES = [
  '/_next',
  '/api/',
  '/favicon',
  '/robots.txt',
  '/sitemap',
  '/manifest',
];

const SKIP_EXTENSIONS =
  /\.(ico|png|jpg|jpeg|gif|webp|svg|css|js|map|txt|xml|woff2?|ttf|eot|mp4|webm|pdf)$/i;

/**
 * Whether this path is a trackable page (not assets / API / Next internals).
 */
export function shouldTrackPath(pathname: string): boolean {
  if (!pathname || pathname.startsWith('//')) return false;
  if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return false;
  }
  if (SKIP_EXTENSIONS.test(pathname)) return false;
  return true;
}

/**
 * Server middleware should record:
 * - Full document navigations (humans)
 * - Likely bots (often omit Sec-Fetch-Dest)
 * Skip RSC / prefetch noise.
 */
export function shouldTrackServerRequest(args: {
  pathname: string;
  method: string;
  headers: Headers;
  isBot: boolean;
}): boolean {
  const { pathname, method, headers, isBot } = args;

  if (method !== 'GET' && method !== 'HEAD') return false;
  if (!shouldTrackPath(pathname)) return false;

  // Next.js App Router soft-nav / prefetch noise
  if (headers.get('rsc') === '1') return false;
  if (headers.get('next-router-prefetch') === '1') return false;
  if (headers.get('purpose') === 'prefetch') return false;
  if (headers.get('x-middleware-prefetch') === '1') return false;
  if (headers.has('next-router-state-tree')) return false;

  const dest = headers.get('sec-fetch-dest');
  if (isBot) return true;
  if (dest === 'document' || dest === null || dest === '') return true;
  return false;
}

/** Strip sensitive-looking query keys before persistence. */
const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'code',
  'state',
  'session',
  'password',
  'secret',
  'api_key',
  'apikey',
  'key',
  'auth',
]);

export function sanitizeQuery(search: string): string | null {
  if (!search) return null;
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      params.set(key, '[redacted]');
    }
  }
  const out = params.toString();
  return out || null;
}

export function extractUtm(search: string | null | undefined): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
} {
  if (!search) {
    return {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
    };
  }
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  return {
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
    utmTerm: params.get('utm_term'),
    utmContent: params.get('utm_content'),
  };
}
