import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listSessionsForUser } from '@/lib/sessions';

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
