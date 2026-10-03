export const ANON_RATE_LIMIT_FALLBACK = 5;

export type RateLimitInfo = {
  count: number;
  limit: number;
  userType: 'authenticated' | 'anonymous';
};

/**
 * Pulls a RateLimitInfo out of the shapes our error payloads can take:
 * `error.rateLimit` (thrown by adk-client) or `error.response.data.rateLimit`
 * (axios-style nesting). Returns null when there is no rate-limit payload.
 */
export function extractRateLimit(source: unknown): RateLimitInfo | null {
  if (!source || typeof source !== 'object') return null;
  const s = source as { rateLimit?: unknown; response?: { data?: { rateLimit?: unknown } } };
  const raw = (s.rateLimit ?? s.response?.data?.rateLimit ?? null) as
    | { count?: unknown; limit?: unknown; userType?: unknown }
    | null;
  if (!raw || typeof raw !== 'object') return null;
  return {
    count: Number(raw.count) || 0,
    limit: Number(raw.limit) || ANON_RATE_LIMIT_FALLBACK,
    userType: raw.userType === 'authenticated' ? 'authenticated' : 'anonymous',
  };
}

/** True for a 429 from any client surface (fetch error, axios-style, ADK custom). */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { status?: unknown; response?: { status?: unknown }; message?: unknown };
  if (e.status === 429) return true;
  if (e.response?.status === 429) return true;
  return typeof e.message === 'string' && e.message.includes('429');
}
