import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  CONSENT_COOKIE_NAME,
  hasAnalyticsConsent,
  parseConsent,
} from '@/lib/analytics/consent';
import { resolveGeo } from '@/lib/analytics/geo';
import { verifyForwardedClient } from '@/lib/analytics/internal-ingest';
import { recordPageview } from '@/lib/analytics/record-pageview';
import {
  VISITOR_COOKIE_NAME,
  createVisitorId,
  isValidVisitorId,
  visitorCookieOptions,
} from '@/lib/analytics/visitor-cookie';
import { shouldTrackPath } from '@/lib/analytics/should-track';
import { reserveBuckets } from '@/lib/limits/limiter';
import { dbCounterStore } from '@/lib/limits/db-store';
import { envInt } from '@/lib/env-int';
import { extractClientIp, hashIp } from '@/lib/analytics/hash-ip';

export const runtime = 'nodejs';

/**
 * Only these fields are read from the body. Identity (user id), IP and geo are
 * always derived on the server; anything else a client sends is ignored.
 */
type Body = {
  path?: string;
  query?: string | null;
  referrer?: string | null;
  language?: string | null;
  visitorId?: string | null;
};

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value ? value.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  try {
    // A signed hit comes from our middleware and carries the real visitor IP
    // and geo; anything else is a browser beacon and uses its own headers.
    const forwarded = await verifyForwardedClient(request.headers);
    const internal = forwarded !== null;
    const clientIp = internal ? forwarded.ip : extractClientIp(request.headers);

    // Analytics never blocks the user: over-limit or DB trouble just skips recording.
    const ipHash = hashIp(clientIp);
    if (ipHash) {
      const ipLimit = envInt('PAGEVIEW_IP_DAILY_LIMIT', 3000);
      const quota = await reserveBuckets([{ key: `pv:ip:${ipHash}`, limit: ipLimit }], {
        store: dbCounterStore,
      });
      if (!quota.ok) {
        return NextResponse.json({ ok: true, recorded: false, reason: quota.reason });
      }
    }

    let body: Body;
    try {
      const parsed = (await request.json()) as unknown;
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      body = parsed as Body;
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const path = (str(body.path, 2048) || '/').split('?')[0];
    if (!shouldTrackPath(path)) {
      return NextResponse.json({ ok: true, recorded: false, reason: 'skipped_path' });
    }

    const consent = parseConsent(request.cookies.get(CONSENT_COOKIE_NAME)?.value);
    const analyticsOk = hasAnalyticsConsent(consent);
    // Middleware already minted (or read) the visitor id; browsers use the cookie.
    const bodyVisitorId = internal && isValidVisitorId(body.visitorId) ? body.visitorId! : null;

    let visitorId: string;
    let setVisitorCookie = false;

    if (analyticsOk) {
      const cookieId = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
      visitorId = bodyVisitorId || (isValidVisitorId(cookieId) ? cookieId! : '');
      if (!visitorId) {
        visitorId = createVisitorId();
        setVisitorCookie = true;
      }
    } else {
      // Cookieless aggregate hit — ephemeral id, never persist ad_vid.
      visitorId = bodyVisitorId || createVisitorId();
    }

    let userId: string | null = null;
    if (analyticsOk) {
      try {
        userId = (await auth())?.user?.id ?? null;
      } catch {
        // auth optional for analytics
      }
    }

    const result = await recordPageview({
      path,
      query: str(body.query, 2048) ?? request.nextUrl.search,
      referrer: str(body.referrer, 2048) ?? request.headers.get('referer'),
      visitorId,
      userId,
      userAgent: request.headers.get('user-agent'),
      language: str(body.language, 64) ?? request.headers.get('accept-language'),
      source: internal ? 'server' : 'client',
      clientIp,
      // Signed hits carry the visitor's edge geo (none off Vercel: then look the
      // IP up). This request's own geo headers describe our egress, not the visitor.
      geo: internal
        ? forwarded.country
          ? { country: forwarded.country, region: forwarded.region, city: forwarded.city }
          : await resolveGeo(new Headers(), clientIp)
        : undefined,
      consented: analyticsOk,
      headers: request.headers,
    });

    const response = NextResponse.json({
      ok: true,
      recorded: result.recorded,
      reason: result.reason,
      id: result.id,
    });

    if (setVisitorCookie) {
      response.cookies.set(
        VISITOR_COOKIE_NAME,
        visitorId,
        visitorCookieOptions(request.nextUrl.protocol === 'https:')
      );
    }

    return response;
  } catch (error) {
    console.error('[analytics] pageview route error', error);
    return NextResponse.json(
      { ok: true, recorded: false, reason: 'route_error' },
      { status: 200 }
    );
  }
}
