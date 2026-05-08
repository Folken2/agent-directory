import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTranscriptForUser } from '@/lib/sessions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  try {
    const transcript = await getSessionTranscriptForUser(session.user.id, sessionId);
    if (!transcript) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ transcript });
  } catch (error) {
    console.error('Error loading session transcript:', error);
    return NextResponse.json({ error: 'Failed to load transcript' }, { status: 500 });
  }
}
