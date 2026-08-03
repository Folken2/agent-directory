import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  CONSENT_COOKIE_NAME,
  hasAnalyticsConsent,
  parseConsent,
} from '@/lib/analytics/consent';
import {
  recordEngagement,
  type EngagementEventType,
} from '@/lib/analytics/record-engagement';
import {
  VISITOR_COOKIE_NAME,
  isValidVisitorId,
} from '@/lib/analytics/visitor-cookie';

export const runtime = 'nodejs';

const ALLOWED: EngagementEventType[] = [
  'agent_open',
  'message_sent',
  'tool_call',
  'heartbeat',
];

type Body = {
  eventType?: string;
  agentSlug?: string | null;
  path?: string;
  sessionKey?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

export async function POST(request: NextRequest) {
  try {
    const consent = parseConsent(request.cookies.get(CONSENT_COOKIE_NAME)?.value);
    if (!hasAnalyticsConsent(consent)) {
      return NextResponse.json({
        ok: true,
        recorded: false,
        reason: 'no_consent',
      });
    }

    const visitorId = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
    if (!isValidVisitorId(visitorId)) {
      return NextResponse.json({
        ok: true,
        recorded: false,
        reason: 'no_visitor',
      });
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    const eventType = body.eventType as EngagementEventType;
    if (!ALLOWED.includes(eventType)) {
      return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 });
    }

    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.user?.id ?? null;
    } catch {
      // optional
    }

    const result = await recordEngagement({
      visitorId: visitorId!,
      userId,
      agentSlug: body.agentSlug ?? null,
      eventType,
      path: body.path || request.headers.get('referer') || '/',
      sessionKey: body.sessionKey ?? null,
      durationMs: body.durationMs ?? null,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[analytics] engagement route error', error);
    return NextResponse.json(
      { ok: true, recorded: false, reason: 'route_error' },
      { status: 200 }
    );
  }
}
