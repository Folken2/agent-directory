/** Bytes of a `data:<mime>;base64,<data>` URL (what /api/artifacts returns), or null. */
export function dataUrlToBytes(url: string): { mimeType: string; bytes: Uint8Array<ArrayBuffer> } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]*)$/.exec(url);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mimeType: match[1], bytes };
  } catch {
    return null;
  }
}
