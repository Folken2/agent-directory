import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  CONSENT_COOKIE_NAME,
  hasAnalyticsConsent,
  parseConsent,
} from '@/lib/analytics/consent';
import {
  MAX_BODY_BYTES,
  isConsentOnlyEvent,
  parseEngagementBody,
} from '@/lib/analytics/engagement-input';
import { extractClientIp, hashIp } from '@/lib/analytics/hash-ip';
import { recordEngagement } from '@/lib/analytics/record-engagement';
import {
  VISITOR_COOKIE_NAME,
  createVisitorId,
  isValidVisitorId,
} from '@/lib/analytics/visitor-cookie';
import { envInt } from '@/lib/env-int';
import { dbCounterStore } from '@/lib/limits/db-store';
import { reserveBuckets } from '@/lib/limits/limiter';

export const runtime = 'nodejs';

function skipped(reason: string) {
  return NextResponse.json({ ok: true, recorded: false, reason });
}

export async function POST(request: NextRequest) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    let referer = '/';
    try {
      const ref = request.headers.get('referer');
      if (ref) referer = new URL(ref).pathname;
    } catch {
      // keep '/'
    }
    const parsed = parseEngagementBody(raw, referer);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }
    const body = parsed.value;

    const consent = parseConsent(request.cookies.get(CONSENT_COOKIE_NAME)?.value);
    const analyticsOk = hasAnalyticsConsent(consent);
    if (!analyticsOk && isConsentOnlyEvent(body.eventType)) return skipped('no_consent');

    let visitorId: string;
    if (analyticsOk) {
      const cookieId = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
      if (!isValidVisitorId(cookieId)) return skipped('no_visitor');
      visitorId = cookieId!;
    } else {
      // Cookieless funnel click — ephemeral id, like an essential-only pageview.
      visitorId = createVisitorId();
    }

    const ipHash = hashIp(extractClientIp(request.headers));
    if (ipHash) {
      const quota = await reserveBuckets(
        [{ key: `ev:ip:${ipHash}`, limit: envInt('ENGAGEMENT_IP_DAILY_LIMIT', 2000) }],
        { store: dbCounterStore }
      );
      if (!quota.ok) return skipped(quota.reason);
    }

    let userId: string | null = null;
    if (analyticsOk) {
      try {
        userId = (await auth())?.user?.id ?? null;
      } catch {
        // optional
      }
    }

    const result = await recordEngagement({ ...body, visitorId, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[analytics] engagement route error', error);
    return NextResponse.json(
      { ok: true, recorded: false, reason: 'route_error' },
      { status: 200 }
    );
  }
}
