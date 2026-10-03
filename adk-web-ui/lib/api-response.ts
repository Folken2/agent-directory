import { NextResponse } from 'next/server';
import {
  API_ERROR_STATUS,
  apiErrorBody,
  type ApiErrorCode,
  type RateLimitPayload,
} from './api-error';

/** JSON error response; `log` (if given) is written server-side only. */
export function apiError(
  code: ApiErrorCode,
  requestId: string,
  opts: { message?: string; rateLimit?: RateLimitPayload; log?: unknown } = {}
): NextResponse {
  const status = API_ERROR_STATUS[code];
  if (opts.log !== undefined) {
    const line = `[api] ${code} requestId=${requestId}`;
    if (status >= 500) console.error(line, opts.log);
    else console.warn(line, opts.log);
  }
  return NextResponse.json(apiErrorBody(code, requestId, opts), {
    status,
    headers: { 'x-request-id': requestId },
  });
}
