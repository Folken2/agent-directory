import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';
import { fetchOpsInsights } from '@/lib/analytics/ops-insights';
import { parseTimelineRange } from '@/lib/analytics/timeline-range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const range = parseTimelineRange(request.nextUrl.searchParams.get('range'));
  try {
    const data = await fetchOpsInsights(range);
    return NextResponse.json({ ok: true, data }, { headers: NO_STORE });
  } catch (error) {
    console.error('[analytics] ops insights route error', error);
    return NextResponse.json({ ok: false, error: 'insights_unavailable' }, { status: 500, headers: NO_STORE });
  }
}
