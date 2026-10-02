import { NextResponse, type NextRequest } from 'next/server';
import { assertAppName, assertId } from './adk-url';
import { apiError } from './api-response';
import { adkUserIdForSession, type ResolvedIdentity } from './identity';
import { resolveIdentity } from './identity-server';
import { findOwnedAdkUserId } from './sessions';

export type AdkScope = {
  appName: string;
  sessionId: string;
  adkUserId: string;
  resolved: ResolvedIdentity;
};

/** Validated app/session + the caller's own ADK user id. Ignores any client user_id. */
export async function resolveAdkScope(
  request: NextRequest,
  requestId: string
): Promise<AdkScope | NextResponse> {
  const params = request.nextUrl.searchParams;
  let appName: string;
  let sessionId: string;
  try {
    appName = assertAppName(params.get('app_name'));
    sessionId = assertId(params.get('session_id'), 'session_id');
  } catch (error) {
    return apiError('invalid_input', requestId, { log: error });
  }
  const resolved = await resolveIdentity(request);
  const adkUserId = await adkUserIdForSession(resolved.identity, sessionId, findOwnedAdkUserId);
  return { appName, sessionId, adkUserId, resolved };
}

export function isScopeError(v: AdkScope | NextResponse): v is NextResponse {
  return v instanceof NextResponse;
}
