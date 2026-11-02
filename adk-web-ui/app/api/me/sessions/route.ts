import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteSessionsForUser, listSessionsForUser } from '@/lib/sessions';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ sessions: [] });
  }
  try {
    const agent = req.nextUrl.searchParams.get('agent') || undefined;
    const sessions = await listSessionsForUser(session.user.id, agent);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error listing user sessions:', error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

/** Deletes all of the signed-in user's chat history. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ deleted: 0 });
  }
  try {
    const deleted = await deleteSessionsForUser(session.user.id);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('Error deleting user sessions:', error);
    return NextResponse.json({ error: 'Failed to delete sessions' }, { status: 500 });
  }
}
