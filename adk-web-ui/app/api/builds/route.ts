import { NextResponse, type NextRequest } from 'next/server';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { isDbEnabled } from '@/lib/db';
import { adkUserIdForSession, applyIdentityCookie } from '@/lib/identity';
import { resolveIdentity } from '@/lib/identity-server';
import { dbCounterStore } from '@/lib/limits/db-store';
import { releaseReservation, reserveBuckets } from '@/lib/limits/limiter';
import { rejectCrossOrigin } from '@/lib/origin-guard';
import { findOwnedAdkUserId } from '@/lib/sessions';
import { fetchBuildZip, loadSessionBuild } from '@/lib/build/adk-build';
import { buildConfig } from '@/lib/build/config';
import { buildSaveStore } from '@/lib/build/db-store';
import { notifyOwner } from '@/lib/build/notify';
import { resendEmailClient } from '@/lib/build/resend-client';
import { handleSaveBuild } from '@/lib/build/save-handler';
import { addUpdatesContact, sendBuildLink } from '@/lib/build/sender';
import { newBuildToken } from '@/lib/build/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Email me a permanent link": store the caller's latest build zip and email
 * them a private link to it. Body: {email, sessionId, updates, help}; the
 * build and zip are read server side from the caller's own ADK session.
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('invalid_input', requestId, { log: 'invalid json' });
  }

  const config = buildConfig();
  const client = config.email ? resendEmailClient(config.email.apiKey) : null;
  const sender = client && config.email ? { client, from: config.email.from, replyTo: config.email.replyTo } : null;

  const result = await handleSaveBuild(body, {
    config,
    origin: request.nextUrl.origin,
    dbEnabled: isDbEnabled,
    resolveIdentity: () => resolveIdentity(request),
    adkUserId: (identity, sessionId) => adkUserIdForSession(identity, sessionId, findOwnedAdkUserId),
    reserve: (buckets) => reserveBuckets(buckets, { store: dbCounterStore }),
    release: (reservation) => releaseReservation(reservation, dbCounterStore),
    loadBuild: loadSessionBuild,
    fetchZip: fetchBuildZip,
    store: buildSaveStore,
    newToken: () => newBuildToken(),
    sendLink: (args) => sendBuildLink(sender, args),
    addContact: (email) => addUpdatesContact(client, email, config.segmentId),
    notify: (n) => notifyOwner(n, config.webhook),
  });

  const res = result.ok
    ? NextResponse.json({ success: true, data: result.data }, { headers: { 'x-request-id': requestId } })
    : apiError(result.code, requestId, { message: result.message, log: result.log });
  if (result.resolved) applyIdentityCookie(res, result.resolved);
  return res;
}
