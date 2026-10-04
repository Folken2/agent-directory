import { toStandardBase64 } from '../artifact-base64';

type InlineData = { data?: unknown };

/** Bytes of an ADK artifact `Part` (inlineData or inline_data, url-safe base64). */
export function partBytes(part: unknown): Buffer | null {
  if (!part || typeof part !== 'object') return null;
  const p = part as { inlineData?: InlineData; inline_data?: InlineData };
  const data = (p.inlineData ?? p.inline_data)?.data;
  if (typeof data !== 'string' || data.length === 0) return null;
  const bytes = Buffer.from(toStandardBase64(data), 'base64');
  return bytes.length > 0 ? bytes : null;
}
