/**
 * CSRF guard for mutating JSON routes. Browsers always send Origin on
 * cross-site POST/DELETE; requests with neither Origin nor Sec-Fetch-Site are
 * non-browser clients, which can't ride a victim's cookies.
 */
export function isAllowedOrigin(headers: Headers, allowed: string[]): boolean {
  const origin = headers.get('origin');
  if (origin) return allowed.includes(origin);
  const site = headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  return true;
}

function toOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function allowedOrigins(requestOrigin: string): string[] {
  const candidates = [
    requestOrigin,
    toOrigin(process.env.NEXT_PUBLIC_BASE_URL),
    toOrigin(process.env.AUTH_URL),
    toOrigin(process.env.NEXTAUTH_URL),
  ];
  return [...new Set(candidates.filter((v): v is string => Boolean(v)))];
}
