import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';
import { emptyPageviewStats, getPageviewStats } from '@/lib/analytics/stats';
import { parseTimelineRange } from '@/lib/analytics/timeline-range';

export const runtime = 'nodejs';
/** Fresh per request at the edge; `unstable_cache` + tag invalidation handle DB load. */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const range = parseTimelineRange(request.nextUrl.searchParams.get('range'));
  try {
    const stats = (await getPageviewStats(range)) ?? emptyPageviewStats(range);
    return NextResponse.json(
      { ok: true, stats },
      {
        headers: {
          // Do not CDN-cache — visits must reflect recent pageviews after tag bust.
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch (error) {
    console.error('[analytics] stats route error', error);
    return NextResponse.json(
      { ok: true, stats: emptyPageviewStats(range) },
      { status: 200 }
    );
  }
}
