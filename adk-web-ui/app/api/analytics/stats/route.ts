import { NextResponse } from 'next/server';
import { emptyPageviewStats, getPageviewStats } from '@/lib/analytics/stats';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET() {
  try {
    const stats = (await getPageviewStats()) ?? emptyPageviewStats();
    return NextResponse.json(
      { ok: true, stats },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
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
