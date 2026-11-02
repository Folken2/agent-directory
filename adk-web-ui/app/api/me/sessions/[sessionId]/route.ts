import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteSessionsForUser, getSessionTranscriptForUser } from '@/lib/sessions';

const SHARED_CHAT_MESSAGE =
  'This chat is from before sign-in and someone else used it too, so it can only be deleted through the contact page.';

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

/** Deletes one conversation from the signed-in user's chat history. */
export async function DELETE(
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
    const { deleted, kept } = await deleteSessionsForUser(session.user.id, sessionId);
    if (deleted === 0 && kept > 0) {
      return NextResponse.json({ error: SHARED_CHAT_MESSAGE }, { status: 409 });
    }
    if (deleted === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ deleted, kept });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
