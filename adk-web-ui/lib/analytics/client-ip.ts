/**
 * Client IP from proxy headers. Which header is trustworthy depends on the
 * host's edge: set TRUSTED_IP_HEADER (e.g. `x-real-ip` or
 * `x-forwarded-for:last`) after verifying with a spoofed-header request.
 * No Node imports: used by edge middleware too.
 */
export function extractClientIp(
  headers: Headers,
  trusted: string | undefined = process.env.TRUSTED_IP_HEADER
): string | null {
  if (trusted) {
    const [name, position] = trusted.toLowerCase().split(':');
    const raw = headers.get(name);
    if (!raw) return null;
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    return (position === 'last' ? parts[parts.length - 1] : parts[0]) ?? null;
  }
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return headers.get('x-real-ip')?.trim() || null;
}
