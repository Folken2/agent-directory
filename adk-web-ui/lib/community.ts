/**
 * Agent stars trusted client-supplied identities.
 * Writes stay off until they're rebuilt on auth(); reads still work.
 */
export function communityWritesEnabled(): boolean {
  return process.env.COMMUNITY_WRITE_ENABLED === 'true';
}
