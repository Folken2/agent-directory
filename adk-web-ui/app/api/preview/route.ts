import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adkFetch } from '@/lib/adk-config';
import { adkPath, assertId } from '@/lib/adk-url';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { envInt } from '@/lib/env-int';
import { adkUserIdForSession } from '@/lib/identity';
import { resolveIdentity } from '@/lib/identity-server';
import { rejectCrossOrigin } from '@/lib/origin-guard';
import { parsePreviewRun, previewError } from '@/lib/preview/types';
import { findOwnedAdkUserId } from '@/lib/sessions';
import { guardStream } from '@/lib/stream-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS_TIMEOUT_MS = 30_000;

/**
 * The live preview of the agent being built (`?session_id=` the builder chat).
 *
 * The browser never learns where the preview runs: this route checks the
 * caller owns the builder session, then the ADK backend's preview proxy
 * (internal token) reaches the private sandbox port.
 */
async function scope(request: NextRequest, requestId: string): Promise<{ base: string } | NextResponse> {
  let sessionId: string;
  try {
    sessionId = assertId(request.nextUrl.searchParams.get('session_id'), 'session_id');
  } catch (error) {
    return apiError('invalid_input', requestId, { log: error });
  }
  // The caller's own ADK user id, never one the client sends.
  const resolved = await resolveIdentity(request);
  const adkUserId = await adkUserIdForSession(resolved.identity, sessionId, findOwnedAdkUserId);
  return { base: adkPath('builder', 'preview', adkUserId, sessionId) };
}

export async function GET(request: NextRequest) {
  const requestId = newRequestId();
  const scoped = await scope(request, requestId);
  if (scoped instanceof NextResponse) return scoped;
  try {
    const response = await adkFetch(scoped.base, { method: 'GET', timeoutMs: 10_000 });
    if (!response.ok) {
      const { code } = previewError(response.status);
      return apiError(code, requestId, { log: { status: response.status } });
    }
    return NextResponse.json({ success: true, data: await response.json() });
  } catch (error) {
    return apiError('backend_unavailable', requestId, { log: error });
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = newRequestId();
  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;
  const scoped = await scope(request, requestId);
  if (scoped instanceof NextResponse) return scoped;
  try {
    const response = await adkFetch(scoped.base, { method: 'DELETE', timeoutMs: 30_000 });
    if (!response.ok) return apiError('backend_unavailable', requestId, { log: { status: response.status } });
    return NextResponse.json({ success: true, data: await response.json() });
  } catch (error) {
    return apiError('backend_unavailable', requestId, { log: error });
  }
}

export async function POST(request: NextRequest) {
  const requestId = newRequestId();
  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;
  const scoped = await scope(request, requestId);
  if (scoped instanceof NextResponse) return scoped;

  let run;
  try {
    run = parsePreviewRun(await request.json());
  } catch (error) {
    return apiError('invalid_input', requestId, { log: error });
  }
  if ('error' in run) return apiError('invalid_input', requestId, { log: run.error });

  // Client disconnect or Stop → abort the preview run so it stops spending.
  const upstream = new AbortController();
  request.signal.addEventListener('abort', () => upstream.abort(), { once: true });
  const headersTimer = setTimeout(() => upstream.abort(), HEADERS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await adkFetch(`${scoped.base}/run_sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(run),
      signal: upstream.signal,
    });
  } catch (error) {
    clearTimeout(headersTimer);
    return apiError('backend_unavailable', requestId, { log: error });
  }
  clearTimeout(headersTimer);

  if (!response.ok || !response.body) {
    const { code, message } = previewError(response.status);
    const detail = await response.text().catch(() => '');
    return apiError(code, requestId, { message, log: { status: response.status, detail: detail.slice(0, 300) } });
  }

  const stream = guardStream(response.body, {
    idleMs: envInt('STREAM_IDLE_TIMEOUT_MS', 90_000),
    maxMs: envInt('STREAM_MAX_DURATION_MS', 600_000),
    abortUpstream: () => upstream.abort(),
    onEnd: (outcome) => {
      if (outcome !== 'completed' && !request.signal.aborted) {
        console.warn(`[preview] stream ended ${outcome} requestId=${requestId}`);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'x-request-id': requestId,
    },
  });
}
