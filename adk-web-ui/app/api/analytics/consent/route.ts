import { NextRequest, NextResponse } from 'next/server';
import {
  CONSENT_COOKIE_NAME,
  consentCookieOptions,
  parseConsent,
  type ConsentLevel,
} from '@/lib/analytics/consent';
import {
  VISITOR_COOKIE_NAME,
  createVisitorId,
  isValidVisitorId,
  visitorCookieOptions,
} from '@/lib/analytics/visitor-cookie';

export const runtime = 'nodejs';

type Body = { level?: string };

/**
 * Persist consent choice. Sets/clears httpOnly `ad_vid` because the client
 * cannot mutate that cookie.
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const level = parseConsent(body.level);
  if (!level) {
    return NextResponse.json({ ok: false, error: 'invalid_level' }, { status: 400 });
  }

  const secure = request.nextUrl.protocol === 'https:';
  const response = NextResponse.json({ ok: true, level });

  response.cookies.set(CONSENT_COOKIE_NAME, level, consentCookieOptions(secure));

  if (level === 'all') {
    const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
    const visitorId = isValidVisitorId(existing) ? existing! : createVisitorId();
    response.cookies.set(
      VISITOR_COOKIE_NAME,
      visitorId,
      visitorCookieOptions(secure)
    );
  } else {
    response.cookies.set(VISITOR_COOKIE_NAME, '', {
      ...visitorCookieOptions(secure),
      maxAge: 0,
    });
  }

  return response;
}

export type { ConsentLevel };
