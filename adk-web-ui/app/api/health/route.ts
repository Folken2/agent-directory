import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Deploy gate for Railway. Deliberately does not call the ADK backend. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: 'ok' });
  } catch (error) {
    console.error('[health] db check failed', error);
    return NextResponse.json({ ok: false, db: 'error' }, { status: 503 });
  }
}
