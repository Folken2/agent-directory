import { NextResponse } from 'next/server';
import { emptyPageviewStats, getPageviewStats } from '@/lib/analytics/stats';

export const runtime = 'nodejs';
/** Fresh per request at the edge; `unstable_cache` + tag invalidation handle DB load. */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = (await getPageviewStats()) ?? emptyPageviewStats();
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
      { ok: true, stats: emptyPageviewStats() },
      { status: 200 }
    );
  }
}
