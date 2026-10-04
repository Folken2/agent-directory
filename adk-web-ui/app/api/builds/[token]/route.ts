import { NextResponse, type NextRequest } from 'next/server';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { isDbEnabled } from '@/lib/db';
import { rejectCrossOrigin } from '@/lib/origin-guard';
import { buildLinkStore } from '@/lib/build/db-store';
import { handleBuildDelete } from '@/lib/build/link-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Self-service deletion promised by /privacy: wipes the zip and the email. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = newRequestId();
  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;
  const { token } = await params;
  if (!isDbEnabled()) return apiError('not_found', requestId);
  try {
    const out = await handleBuildDelete(token, buildLinkStore);
    if (out.status === 404) return apiError('not_found', requestId);
    return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return apiError('internal', requestId, { log: error instanceof Error ? error.name : 'unknown' });
  }
}
