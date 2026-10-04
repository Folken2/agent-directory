import { adkFetch } from '@/lib/adk-config';
import { adkPath, assertArtifactName } from '@/lib/adk-url';
import { BUILDER_AGENT } from '@/lib/builder';
import { parseBuild } from './parse';
import { BUILD_STATE_KEY, type Build, type SessionBuildLookup, type ZipLookup } from './types';
import { partBytes } from './zip-part';

/** `builder:build` from the caller's own ADK session (adkUserId comes from identity, never the client). */
export async function loadSessionBuild(adkUserId: string, sessionId: string): Promise<SessionBuildLookup> {
  try {
    const res = await adkFetch(adkPath('apps', BUILDER_AGENT, 'users', adkUserId, 'sessions', sessionId), {
      method: 'GET',
      timeoutMs: 10_000,
    });
    if (res.status === 404) return { kind: 'missing' };
    if (!res.ok) return { kind: 'unavailable' };
    const session = (await res.json()) as { state?: Record<string, unknown> } | null;
    const build = parseBuild(session?.state?.[BUILD_STATE_KEY]);
    return build ? { kind: 'ok', build } : { kind: 'missing' };
  } catch {
    return { kind: 'unavailable' };
  }
}

/** The zip artifact by name and version; `gone` after a backend restart. */
export async function fetchBuildZip(
  adkUserId: string,
  sessionId: string,
  build: Pick<Build, 'artifact' | 'version'>,
): Promise<ZipLookup> {
  try {
    const name = assertArtifactName(build.artifact);
    const base = adkPath('apps', BUILDER_AGENT, 'users', adkUserId, 'sessions', sessionId, 'artifacts', name);
    const res = await adkFetch(`${base}?version=${build.version}`, { method: 'GET', timeoutMs: 30_000 });
    if (res.status === 404) return { kind: 'gone' };
    if (!res.ok) return { kind: 'unavailable' };
    const bytes = partBytes(await res.json());
    return bytes ? { kind: 'ok', bytes } : { kind: 'gone' };
  } catch {
    return { kind: 'unavailable' };
  }
}
