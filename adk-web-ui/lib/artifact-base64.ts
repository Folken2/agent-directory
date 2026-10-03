/**
 * ADK serializes artifact bytes as URL-safe base64 (`-` and `_`, often
 * unpadded). Browsers decode `data:` URLs with the standard alphabet only, so
 * a URL-safe payload in a data URL downloads as a corrupt file. Convert to
 * standard, padded base64 before building one.
 */
export function toStandardBase64(value: string): string {
  const cleaned = value.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const remainder = cleaned.length % 4;
  return remainder ? cleaned + '='.repeat(4 - remainder) : cleaned;
}
