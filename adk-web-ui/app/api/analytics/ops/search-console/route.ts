import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';
import { fetchSearchConsoleReport, GSC_WINDOWS } from '@/lib/analytics/search-console';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const reports = await Promise.all(GSC_WINDOWS.map((days) => fetchSearchConsoleReport(days)));
  return NextResponse.json(
    { ok: true, reports },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
