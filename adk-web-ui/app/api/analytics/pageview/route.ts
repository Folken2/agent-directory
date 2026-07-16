import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordPageview } from '@/lib/analytics/record-pageview';
import {
  VISITOR_COOKIE_NAME,
  createVisitorId,
  isValidVisitorId,
  visitorCookieOptions,
} from '@/lib/analytics/visitor-cookie';
import { shouldTrackPath } from '@/lib/analytics/should-track';

export const runtime = 'nodejs';

type Body = {
  path?: string;
  query?: string | null;
  referrer?: string | null;
  userId?: string | null;
  source?: 'server' | 'client';
  country?: string | null;
  region?: string | null;
  city?: string | null;
  language?: string | null;
  visitorId?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const path = (body.path || '/').split('?')[0];
    if (!shouldTrackPath(path)) {
      return NextResponse.json({ ok: true, recorded: false, reason: 'skipped_path' });
    }

    const source = body.source === 'server' ? 'server' : 'client';

    let visitorId =
      (isValidVisitorId(body.visitorId) && body.visitorId) ||
      request.cookies.get(VISITOR_COOKIE_NAME)?.value ||
      null;

    const setVisitorCookie = !isValidVisitorId(visitorId);
    if (setVisitorCookie) {
      visitorId = createVisitorId();
    }

    let userId = body.userId ?? null;
    try {
      const session = await auth();
      if (session?.user?.id) {
        userId = session.user.id;
      }
    } catch {
      // auth optional for analytics
    }

    const result = await recordPageview({
      path,
      query: body.query ?? request.nextUrl.search,
      referrer: body.referrer ?? request.headers.get('referer'),
      visitorId: visitorId!,
      userId,
      userAgent: request.headers.get('user-agent'),
      language: body.language ?? request.headers.get('accept-language'),
      source,
      country: body.country,
      region: body.region,
      city: body.city,
      headers: request.headers,
    });

    const response = NextResponse.json({
      ok: true,
      recorded: result.recorded,
      reason: result.reason,
      id: result.id,
    });

    if (setVisitorCookie && visitorId) {
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
