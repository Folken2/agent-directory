import type { NextRequest, NextResponse } from 'next/server';
import { apiError } from './api-response';
import { allowedOrigins, isAllowedOrigin } from './origin-check';

export function rejectCrossOrigin(request: NextRequest, requestId: string): NextResponse | null {
  if (isAllowedOrigin(request.headers, allowedOrigins(request.nextUrl.origin))) return null;
  return apiError('forbidden', requestId, {
    log: { reason: 'cross_origin', origin: request.headers.get('origin') },
  });
}
