import { adkFetch } from './adk-config';
import { adkPath } from './adk-url';

const PREFLIGHT_TIMEOUT_MS = 10_000; // absorbs backend cold starts (was 2s)

/** ADK requires the session to exist before /run_sse. Inputs must be pre-validated. */
export async function ensureAdkSession(
  appName: string,
  adkUserId: string,
  sessionId: string
): Promise<'ok' | 'unavailable'> {
  try {
    const check = await adkFetch(adkPath('apps', appName, 'users', adkUserId, 'sessions', sessionId), {
      method: 'GET',
      timeoutMs: PREFLIGHT_TIMEOUT_MS,
    });
    if (check.ok) return 'ok';
    if (check.status !== 404) {
      console.error(`[adk-session] check returned ${check.status}`);
      return 'unavailable';
    }
    const create = await adkFetch(adkPath('apps', appName, 'users', adkUserId, 'sessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
      timeoutMs: PREFLIGHT_TIMEOUT_MS,
    });
    if (!create.ok) console.error(`[adk-session] create returned ${create.status}`);
    return create.ok ? 'ok' : 'unavailable';
  } catch (error) {
    console.error('[adk-session] backend unreachable', error);
    return 'unavailable';
  }
}
