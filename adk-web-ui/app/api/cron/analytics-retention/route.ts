import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runAnalyticsRetention } from '@/lib/analytics/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. No secret, no run. */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const report = await runAnalyticsRetention();
    console.info('[analytics] retention run', report);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    console.error('[analytics] retention run failed', error);
    return NextResponse.json({ ok: false, error: 'retention_failed' }, { status: 500 });
  }
}
