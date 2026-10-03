import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';
import { fetchTranscript } from '@/lib/analytics/adk-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
// ADK app names are Python identifiers; session ids are uuid-like.
const APP_RE = /^[A-Za-z0-9_-]{1,128}$/;
const SESSION_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

/** Full transcript of one conversation for the ops conversation browser. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const app = params.get('app') ?? '';
  const sessionId = params.get('session') ?? '';
  if (!APP_RE.test(app) || !SESSION_RE.test(sessionId)) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400, headers: NO_STORE });
  }

  try {
    const entries = await fetchTranscript(app, sessionId);
    if (entries.length === 0) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, entries }, { headers: NO_STORE });
  } catch (error) {
    console.error('[analytics] ops transcript route error', error);
    return NextResponse.json({ ok: false, error: 'transcript_unavailable' }, { status: 500, headers: NO_STORE });
  }
}
