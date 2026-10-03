/**
 * Text assembly for the ADK SSE stream. The stream sometimes re-sends a
 * prefix, the whole text so far, or a fragment already seen; these merge
 * rules keep the accumulated text free of duplicates.
 */

/** Final-author text for the main bubble. */
export function mergeFinalText(prev: string, incoming: string): string {
  if (incoming === prev && prev.length > 0) return prev;
  if (incoming.length > prev.length && incoming.startsWith(prev)) return incoming;
  // A re-emission that shares the first 50 chars is the same text, maybe revised.
  if (prev.length > 50 && incoming.length > 50) {
    const prefixLen = Math.min(50, prev.length, incoming.length);
    if (incoming.substring(0, prefixLen) === prev.substring(0, prefixLen)) {
      return incoming.length >= prev.length ? incoming : prev;
    }
  }
  if (prev.length > 0 && prev.includes(incoming)) return prev;
  return prev + incoming;
}

/** Main-bubble reasoning text. */
export function mergeMainThinking(prev: string, incoming: string): string {
  if (incoming === prev && prev.length > 0) return prev;
  if (incoming.length > prev.length && incoming.startsWith(prev)) return incoming;
  if (prev.length > 0 && prev.includes(incoming)) return prev;
  return prev + incoming;
}

/** Text or reasoning accumulated inside a sub-agent step. */
export function mergeStepText(prev: string | undefined, incoming: string): string {
  if (!prev) return incoming;
  if (incoming === prev) return prev;
  if (incoming.length > prev.length && incoming.startsWith(prev)) return incoming;
  if (prev.includes(incoming)) return prev;
  return prev + incoming;
}
