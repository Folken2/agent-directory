import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { identifyBot } from '@/lib/analytics/bots';
import { extractClientIp } from '@/lib/analytics/client-ip';
import {
  CONSENT_COOKIE_NAME,
  hasAnalyticsConsent,
  parseConsent,
} from '@/lib/analytics/consent';
import { signForwardedClient } from '@/lib/analytics/internal-ingest';
import { shouldTrackServerRequest } from '@/lib/analytics/should-track';
import {
  VISITOR_COOKIE_NAME,
  createVisitorId,
  isValidVisitorId,
  visitorCookieOptions,
} from '@/lib/analytics/visitor-cookie';

/**
 * Where the pageview self-fetch goes. Self-hosted standalone builds derive
 * nextUrl.origin from HOSTNAME:PORT plus the forwarded proto (e.g.
 * https://0.0.0.0:3000), which is unreachable, so post to loopback instead.
 */
function ingestOrigin(request: NextRequest): string {
  if (process.env.ANALYTICS_INGEST_ORIGIN) return process.env.ANALYTICS_INGEST_ORIGIN;
  if (!process.env.VERCEL) return `http://127.0.0.1:${process.env.PORT || 3000}`;
  return request.nextUrl.origin;
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = request.nextUrl;
  const userAgent = request.headers.get('user-agent');
  const bot = identifyBot(userAgent);

  const consent = parseConsent(request.cookies.get(CONSENT_COOKIE_NAME)?.value);
  const analyticsOk = hasAnalyticsConsent(consent);

  const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  const visitorId = analyticsOk
    ? isValidVisitorId(existing)
      ? existing!
      : createVisitorId()
    : createVisitorId(); // ephemeral — not written to cookie

  const response = NextResponse.next();

  if (analyticsOk && !isValidVisitorId(existing)) {
    response.cookies.set(
      VISITOR_COOKIE_NAME,
      visitorId,
      visitorCookieOptions(request.nextUrl.protocol === 'https:')
    );
  }

  const track = shouldTrackServerRequest({
    pathname,
    method: request.method,
    headers: request.headers,
    isBot: bot.isBot,
  });

  if (track) {
    const origin = ingestOrigin(request);
    // Geo and IP travel in signed headers: Vercel overwrites the forwarded and
    // geo headers on the self-fetch with its own egress values.
    const client = {
      ip: extractClientIp(request.headers),
      country: request.headers.get('x-vercel-ip-country'),
      region: request.headers.get('x-vercel-ip-country-region'),
      city: request.headers.get('x-vercel-ip-city'),
    };
    const payload = {
      path: pathname,
      query: search || null,
      referrer: request.headers.get('referer'),
      source: 'server' as const,
      visitorId,
      language: request.headers.get('accept-language'),
    };

    const cookieParts = [`${CONSENT_COOKIE_NAME}=${consent ?? ''}`];
    if (analyticsOk) {
      cookieParts.push(`${VISITOR_COOKIE_NAME}=${visitorId}`);
    }

    const ingest = signForwardedClient(client)
      .then((signed) =>
        fetch(`${origin}/api/analytics/pageview`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'user-agent': userAgent || 'middleware',
            ...signed,
            cookie: cookieParts.join('; '),
          },
          body: JSON.stringify(payload),
        })
      )
      .catch((err) => {
        console.error('[analytics] middleware ingest failed', err);
      });

    event.waitUntil(ingest);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|map|txt|xml|woff2?|ttf|eot)$).*)',
  ],
};
