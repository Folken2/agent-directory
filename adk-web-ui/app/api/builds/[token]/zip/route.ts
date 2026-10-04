import { NextResponse, type NextRequest } from 'next/server';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { isDbEnabled } from '@/lib/db';
import { buildLinkStore } from '@/lib/build/db-store';
import { handleZipDownload } from '@/lib/build/link-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = newRequestId();
  const { token } = await params;
  if (!isDbEnabled()) return apiError('not_found', requestId);
  try {
    const out = await handleZipDownload(token, buildLinkStore);
    if (out.status === 404) return apiError('not_found', requestId);
    return new NextResponse(new Uint8Array(out.body), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${out.fileName}"`,
        'Content-Length': String(out.body.length),
        'Cache-Control': 'private, no-store',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    return apiError('internal', requestId, { log: error instanceof Error ? error.name : 'unknown' });
  }
}
