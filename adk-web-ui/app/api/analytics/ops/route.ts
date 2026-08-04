import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';
import { fetchOpsDashboard } from '@/lib/analytics/ops-queries';
import { parseTimelineRange } from '@/lib/analytics/timeline-range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const range = parseTimelineRange(request.nextUrl.searchParams.get('range'));
  try {
    const data = await fetchOpsDashboard(range);
    return NextResponse.json(
      { ok: true, data },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[analytics] ops route error', error);
    return NextResponse.json(
      { ok: false, error: 'ops_unavailable' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
