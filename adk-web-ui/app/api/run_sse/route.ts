import type { NextRequest } from 'next/server';
import { adkFetch } from '@/lib/adk-config';
import { ensureAdkSession } from '@/lib/adk-session';
import { assertAppName, assertId } from '@/lib/adk-url';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { readRunIdentityCookies } from '@/lib/analytics/run-identity';
import { trackAgentRun } from '@/lib/db-agent-runs';
import { envInt } from '@/lib/env-int';
import {
  adkUserIdForSession,
  applyIdentityCookie,
  identityKey,
  type ResolvedIdentity,
} from '@/lib/identity';
import { resolveIdentity } from '@/lib/identity-server';
import { dbCounterStore } from '@/lib/limits/db-store';
import { limitMessage, releaseReservation, reserveRun } from '@/lib/limits/limiter';
import { rejectCrossOrigin } from '@/lib/origin-guard';
import { findOwnedAdkUserId } from '@/lib/sessions';
import { guardStream } from '@/lib/stream-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS_TIMEOUT_MS = 30_000;

type RunBody = {
  app_name?: unknown;
  session_id?: unknown;
  new_message?: unknown;
};

function withCookie(res: Response, resolved: ResolvedIdentity): Response {
  applyIdentityCookie(res, resolved);
  return res;
}

export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;

  let body: RunBody;
  try {
    body = (await request.json()) as RunBody;
  } catch (error) {
    return apiError('invalid_input', requestId, { log: error });
  }

  let appName: string;
  let sessionId: string;
  try {
    appName = assertAppName(body.app_name);
    sessionId = assertId(body.session_id, 'session_id');
  } catch (error) {
    return apiError('invalid_input', requestId, { log: error });
  }
  if (!body.new_message) return apiError('invalid_input', requestId, { log: 'missing new_message' });

  const resolved = await resolveIdentity(request);
  const { identity } = resolved;

  const reservation = await reserveRun(identity, { store: dbCounterStore });
  if (!reservation.allowed) {
    if (reservation.reason === 'unavailable') {
      return withCookie(apiError('temporarily_unavailable', requestId), resolved);
    }
    return withCookie(
      apiError('rate_limited', requestId, {
        message: limitMessage(reservation.userType, reservation.limit),
        rateLimit: {
          exceeded: true,
          count: reservation.limit,
          limit: reservation.limit,
          userType: reservation.userType,
        },
      }),
      resolved
    );
  }

  const key = identityKey(identity);
  const adkUserId = await adkUserIdForSession(identity, sessionId, findOwnedAdkUserId);
  const cookies = readRunIdentityCookies(request);
  const runIdentity = {
    visitorId: cookies.visitorId,
    anonSessionToken: identity.kind === 'anon' ? identity.anonToken : null,
  };
  const track = (status: 'running' | 'completed' | 'error', message?: string) =>
    trackAgentRun(appName, adkUserId, sessionId, appName, status, message, key, runIdentity).catch(
      (error) => console.error(`[run_sse] tracking failed requestId=${requestId}`, error)
    );

  const failBeforeStream = async (reason: string, log: unknown) => {
    await releaseReservation(reservation.reservation, dbCounterStore);
    await track('error', reason);
    return withCookie(apiError('backend_unavailable', requestId, { log }), resolved);
  };

  await track('running');

  if ((await ensureAdkSession(appName, adkUserId, sessionId)) !== 'ok') {
    return failBeforeStream('session_unavailable', { appName, sessionId });
  }

  const newMessage =
    typeof body.new_message === 'string' ? { parts: [{ text: body.new_message }] } : body.new_message;

  // Client disconnect or Stop → abort the ADK run so it stops spending.
  const upstream = new AbortController();
  request.signal.addEventListener('abort', () => upstream.abort(), { once: true });
  const headersTimer = setTimeout(() => upstream.abort(), HEADERS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await adkFetch('/run_sse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        app_name: appName,
        user_id: adkUserId,
        session_id: sessionId,
        new_message: newMessage,
        streaming: true,
      }),
      signal: upstream.signal,
    });
  } catch (error) {
    clearTimeout(headersTimer);
    return failBeforeStream('upstream_unreachable', error);
  }
  clearTimeout(headersTimer);

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    return failBeforeStream(`upstream_status_${response.status}`, {
      status: response.status,
      detail: detail.slice(0, 500),
    });
  }

  const stream = guardStream(response.body, {
    idleMs: envInt('STREAM_IDLE_TIMEOUT_MS', 90_000),
    maxMs: envInt('STREAM_MAX_DURATION_MS', 600_000),
    abortUpstream: () => upstream.abort(),
    onEnd: (rawOutcome) => {
      // A client disconnect aborts the upstream fetch first, so the guard
      // usually sees that as an upstream error. Record it as the cancel it is.
      const outcome =
        rawOutcome === 'upstream_error' && request.signal.aborted ? 'client_cancelled' : rawOutcome;
      if (outcome === 'completed' || outcome === 'client_cancelled') {
        void track('completed', outcome === 'client_cancelled' ? 'client_cancelled' : undefined);
      } else {
        console.warn(`[run_sse] stream ended ${outcome} requestId=${requestId}`);
        void track('error', outcome);
      }
    },
  });

  return withCookie(
    new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'x-request-id': requestId,
      },
    }),
    resolved
  );
}
