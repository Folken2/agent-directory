/**
 * Browser helpers for community stars. Stars are de-duplicated per browser
 * with an anonymous id kept in localStorage.
 */

export const COMMUNITY_WRITES = process.env.NEXT_PUBLIC_COMMUNITY_WRITE_ENABLED === 'true';

const STAR_SESSION_KEY = 'adk-star-session-id';

function starSessionId(): string {
  try {
    const existing = localStorage.getItem(STAR_SESSION_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(STAR_SESSION_KEY, generated);
    return generated;
  } catch {
    return `session-${Date.now()}`;
  }
}

/** Star or unstar an agent; resolves to the new count, or throws on failure. */
export async function postStar(agentName: string, action: 'star' | 'unstar'): Promise<number | null> {
  const response = await fetch(`/api/agents/${encodeURIComponent(agentName)}/star`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, sessionId: starSessionId() }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Failed to update star');
  }
  return typeof result?.data?.starsCount === 'number' ? result.data.starsCount : null;
}

/** Current star counts by agent name, from the live list. Empty on failure. */
export async function fetchStarCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  try {
    const response = await fetch('/api/agents');
    if (!response.ok) return counts;
    const json = await response.json();
    const list = Array.isArray(json?.data) ? (json.data as Array<{ name?: string; starsCount?: number }>) : [];
    for (const item of list) {
      if (item?.name && typeof item.starsCount === 'number') counts.set(item.name, item.starsCount);
    }
  } catch {
    // Counts are decoration; the list renders without them.
  }
  return counts;
}
