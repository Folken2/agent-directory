/**
 * Server-only access to the ADK backend. The URL is never NEXT_PUBLIC_*, so
 * it is not inlined into client bundles; on Railway it's a private
 * *.railway.internal address and every call carries X-Internal-Token.
 */
if (typeof window !== 'undefined') {
  throw new Error('lib/adk-config is server-only');
}

export function adkServerUrl(): string {
  const raw = process.env.ADK_SERVER_URL;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ADK_SERVER_URL is not set');
    }
    return 'http://localhost:8000';
  }
  return raw.replace(/\/+$/, '');
}

export function adkHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = process.env.ADK_INTERNAL_TOKEN;
  return {
    Accept: 'application/json',
    ...(token ? { 'X-Internal-Token': token } : {}),
    ...extra,
  };
}

export function adkFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs, signal, headers, ...rest } = init;
  const signals = [signal, timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined].filter(
    (s): s is AbortSignal => Boolean(s)
  );
  return fetch(`${adkServerUrl()}${path}`, {
    ...rest,
    headers: adkHeaders((headers as Record<string, string> | undefined) ?? {}),
    signal: signals.length === 0 ? undefined : signals.length === 1 ? signals[0] : AbortSignal.any(signals),
  });
}
