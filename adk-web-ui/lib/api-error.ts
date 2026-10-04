/**
 * Error contract shared by API routes and the browser. Routes never echo
 * upstream bodies or backend URLs: they send a code + friendly copy +
 * requestId, and log details server-side under that requestId.
 */
export type ApiErrorCode =
  | 'backend_unavailable'
  | 'temporarily_unavailable'
  | 'rate_limited'
  | 'invalid_input'
  | 'idle_timeout'
  | 'forbidden'
  | 'not_found'
  | 'gone'
  | 'disabled'
  | 'internal';

export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  backend_unavailable: 503,
  temporarily_unavailable: 503,
  rate_limited: 429,
  invalid_input: 400,
  idle_timeout: 504,
  forbidden: 403,
  not_found: 404,
  gone: 410,
  disabled: 403,
  internal: 500,
};

export const FRIENDLY_MESSAGES: Record<ApiErrorCode, string> = {
  backend_unavailable: 'This agent is waking up or busy. Try again in a moment.',
  temporarily_unavailable: 'The service is temporarily unavailable. Try again in a minute.',
  rate_limited: "You've reached today's limit.",
  invalid_input: 'Something was wrong with that request. Refresh the page and try again.',
  idle_timeout: 'The response timed out. You can retry.',
  forbidden: "You don't have access to that.",
  not_found: "We couldn't find that.",
  gone: 'That is no longer available.',
  disabled: 'This feature is turned off for now.',
  internal: 'Something went wrong on our side. Please try again.',
};

export function isApiErrorCode(v: unknown): v is ApiErrorCode {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(API_ERROR_STATUS, v);
}

export function friendlyMessage(code: unknown): string {
  return isApiErrorCode(code) ? FRIENDLY_MESSAGES[code] : FRIENDLY_MESSAGES.internal;
}

export type RateLimitPayload = {
  exceeded: true;
  count: number;
  limit: number;
  userType: 'authenticated' | 'anonymous';
};

export type ApiErrorBody = {
  success: false;
  code: ApiErrorCode;
  error: string;
  requestId: string;
  rateLimit?: RateLimitPayload;
};

export function apiErrorBody(
  code: ApiErrorCode,
  requestId: string,
  opts: { message?: string; rateLimit?: RateLimitPayload } = {}
): ApiErrorBody {
  return {
    success: false,
    code,
    error: opts.message ?? FRIENDLY_MESSAGES[code],
    requestId,
    ...(opts.rateLimit ? { rateLimit: opts.rateLimit } : {}),
  };
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

export class ChatApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId?: string;
  readonly rateLimit?: RateLimitPayload;

  constructor(
    code: ApiErrorCode,
    status: number,
    opts: { message?: string; requestId?: string; rateLimit?: RateLimitPayload } = {}
  ) {
    super(opts.message ?? friendlyMessage(code));
    this.name = 'ChatApiError';
    this.code = code;
    this.status = status;
    this.requestId = opts.requestId;
    this.rateLimit = opts.rateLimit;
  }
}

export async function errorFromResponse(res: Response): Promise<ChatApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await res.json()) as Partial<ApiErrorBody>;
  } catch {
    body = null;
  }
  const code: ApiErrorCode = isApiErrorCode(body?.code)
    ? body!.code!
    : res.status === 429
      ? 'rate_limited'
      : res.status >= 500
        ? 'backend_unavailable'
        : 'internal';
  return new ChatApiError(code, res.status, {
    message: typeof body?.error === 'string' ? body.error : undefined,
    requestId: body?.requestId ?? res.headers.get('x-request-id') ?? undefined,
    rateLimit: body?.rateLimit,
  });
}
