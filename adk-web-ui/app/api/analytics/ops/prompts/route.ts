import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAnalyticsOpsEmail } from '@/lib/analytics/ops-access';
import {
  fetchPromptThemes,
  fetchRawPromptsPage,
} from '@/lib/analytics/prompt-themes';
import { parseTimelineRange } from '@/lib/analytics/timeline-range';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isAnalyticsOpsEmail(session?.user?.email)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const range = parseTimelineRange(params.get('range'));
  const mode = params.get('mode') === 'raw' ? 'raw' : 'themes';
  const agentSlug = params.get('agent') || undefined;
  const offset = Number(params.get('offset') || '0') || 0;
  const limit = Number(params.get('limit') || '50') || 50;

  try {
    if (mode === 'raw') {
      const page = await fetchRawPromptsPage(range, {
        offset,
        limit,
        agentSlug,
      });
      return NextResponse.json(
        { ok: true, mode: 'raw', ...page },
        { headers: { 'Cache-Control': 'private, no-store' } }
      );
    }

    const themes = await fetchPromptThemes(range);
    return NextResponse.json(
      { ok: true, mode: 'themes', themes },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('[analytics] ops prompts route error', error);
    return NextResponse.json(
      { ok: false, error: 'prompts_unavailable' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
