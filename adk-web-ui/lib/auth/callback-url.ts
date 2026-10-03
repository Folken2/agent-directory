/**
 * Where to land after sign-in. Only same-site paths are allowed, so a crafted
 * `?callbackUrl=` cannot send people to another origin.
 */
export function safeCallbackPath(value: string | string[] | undefined | null, fallback = '/'): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return fallback;
  // "/path" only: no scheme, no protocol-relative "//host", no backslash tricks.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  if (raw.startsWith('/auth/signin')) return fallback;
  return raw;
}

/** Plain-language text for an Auth.js `?error=` code on the sign-in page. */
export function signInErrorMessage(code: string | string[] | undefined | null): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  if (!value) return null;
  if (value === 'AccessDenied') return 'Access was denied. Try a different Google account.';
  return 'Sign-in did not complete. Please try again.';
}
