import { NextRequest, NextResponse } from 'next/server';
import { isDbEnabled, starAgent, unstarAgent } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent: agentSlug } = await params;

  if (!agentSlug) {
    return NextResponse.json({ success: false, error: 'Agent is required' }, { status: 400 });
  }

  if (!isDbEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Database is not configured. Set DATABASE_URL for Neon.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const action = body?.action as 'star' | 'unstar';
    const sessionId = body?.sessionId as string;

    if (!action || !['star', 'unstar'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "star" or "unstar".' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required to track unique stars.' },
        { status: 400 }
      );
    }

    const { starsCount } =
      action === 'star'
        ? await starAgent(agentSlug, sessionId)
        : await unstarAgent(agentSlug, sessionId);

    return NextResponse.json({
      success: true,
      data: { starsCount },
    });
  } catch (error: any) {
    console.error('Error updating star:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update star' },
      { status: 500 }
    );
  }
}

