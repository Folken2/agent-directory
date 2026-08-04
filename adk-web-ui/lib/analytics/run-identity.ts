import type { NextRequest } from 'next/server';
import {
  VISITOR_COOKIE_NAME,
  isValidVisitorId,
} from '@/lib/analytics/visitor-cookie';

export const ANONYMOUS_SESSION_COOKIE_NAME = 'anonymous_session_token';

export type RunIdentityCookies = {
  /** Consented `ad_vid` — never fabricated when absent. */
  visitorId: string | null;
  /** Existing rate-limit anonymous session cookie — never fabricated. */
  anonSessionToken: string | null;
};

/**
 * Read identity cookies for stamping `agent_run_events`.
 * Returns nulls when cookies are missing — do not invent ids.
 */
export function readRunIdentityCookies(
  request: NextRequest
): RunIdentityCookies {
  const rawVid = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  const visitorId = isValidVisitorId(rawVid) ? rawVid! : null;
  const anon = request.cookies.get(ANONYMOUS_SESSION_COOKIE_NAME)?.value;
  const anonSessionToken = anon && anon.length > 0 ? anon : null;
  return { visitorId, anonSessionToken };
}
