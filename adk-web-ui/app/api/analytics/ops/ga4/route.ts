import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { fetchGa4Acquisition } from '@/lib/analytics/ga4';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';
import { parseTimelineRange } from '@/lib/analytics/timeline-range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const range = parseTimelineRange(request.nextUrl.searchParams.get('range'));
  const report = await fetchGa4Acquisition(range);
  return NextResponse.json(
    { ok: true, report },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
