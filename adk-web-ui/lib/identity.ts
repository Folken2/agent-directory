/**
 * The only source of "who is making this request". Routes must never trust a
 * client-supplied user_id: before this module, every ADK session lived under
 * 'default-user' and any session id could be read by anyone.
 */
export const ANON_COOKIE_NAME = 'anonymous_session_token';
const ANON_TOKEN_RE = /^[a-f0-9]{64}$/;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type Identity =
  | { kind: 'user'; userId: string }
  | { kind: 'anon'; anonToken: string; ipHash: string | null };

export type ResolvedIdentity = { identity: Identity; newAnonToken: string | null };

export type IdentityDeps = {
  getUserId(): Promise<string | null>;
  readCookie(name: string): string | undefined;
  ipHash(): string | null;
  mintToken(): string;
};

export async function resolveIdentityWith(deps: IdentityDeps): Promise<ResolvedIdentity> {
  let userId: string | null = null;
  try {
    userId = await deps.getUserId();
  } catch (error) {
    console.error('[identity] auth lookup failed; treating as anonymous', error);
  }
  if (userId) return { identity: { kind: 'user', userId }, newAnonToken: null };

  const ipHash = deps.ipHash();
  const existing = deps.readCookie(ANON_COOKIE_NAME);
  if (existing && ANON_TOKEN_RE.test(existing)) {
    return { identity: { kind: 'anon', anonToken: existing, ipHash }, newAnonToken: null };
  }
  const token = deps.mintToken();
  return { identity: { kind: 'anon', anonToken: token, ipHash }, newAnonToken: token };
}

/** Same value stored in agent_run_events.rate_limit_identifier. */
export function identityKey(identity: Identity): string {
  return identity.kind === 'user' ? identity.userId : identity.anonToken;
}

export function defaultAdkUserId(identity: Identity): string {
  return identity.kind === 'user' ? `u_${identity.userId}` : `a_${identity.anonToken}`;
}

/**
 * ADK user id for a session. Sessions this identity already ran keep the ADK
 * id they were created under (legacy 'default-user' history keeps working);
 * anything else gets the identity's own id, so foreign session ids miss.
 *
 * `findOwned` reads a value legacy code once wrote from client input, so it
 * is only trusted when it matches what this identity would actually own:
 * either the legacy sentinel or this identity's own derived id. Anything
 * else (e.g. a planted row aimed at another identity) is ignored.
 */
export async function adkUserIdForSession(
  identity: Identity,
  sessionId: string,
  findOwned: (key: string, sessionId: string) => Promise<string | null>
): Promise<string> {
  const derived = defaultAdkUserId(identity);
  try {
    const owned = await findOwned(identityKey(identity), sessionId);
    if (owned === 'default-user' || owned === derived) return owned;
  } catch (error) {
    console.error('[identity] session ownership lookup failed', error);
  }
  return derived;
}

/** One ADK session a signed-in user's runs point at (from agent_run_events). */
export type AdkSessionKey = { sessionId: string; appName: string; adkUserId: string };

/**
 * The sessions a signed-in user may delete, out of the keys their runs point
 * at. Same trust rule as {@link adkUserIdForSession}: only their own `u_` id
 * or the legacy 'default-user' sentinel; any other stored id is ignored, so a
 * planted run row can't aim a delete at someone else's session. Deduplicated,
 * since every run of a session writes its own row.
 *
 * Legacy 'default-user' sessions could be run by anyone holding the id, so
 * one that `isShared` (another identity also ran it) is left alone: deleting
 * it would delete someone else's chat too.
 */
export function deletableAdkSessions(
  userId: string,
  keys: AdkSessionKey[],
  isShared: (key: AdkSessionKey) => boolean = () => false
): AdkSessionKey[] {
  const own = defaultAdkUserId({ kind: 'user', userId });
  const seen = new Set<string>();
  const out: AdkSessionKey[] = [];
  for (const key of keys) {
    if (!key.sessionId || !key.appName) continue;
    if (key.adkUserId !== own && key.adkUserId !== 'default-user') continue;
    if (key.adkUserId === 'default-user' && isShared(key)) continue;
    const id = `${key.sessionId}|${key.appName}|${key.adkUserId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(key);
  }
  return out;
}

export function anonCookieHeader(token: string, secure: boolean): string {
  return `${ANON_COOKIE_NAME}=${token}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** Works on any Response, including SSE streams. */
export function applyIdentityCookie(
  res: Response,
  resolved: ResolvedIdentity,
  secure: boolean = process.env.NODE_ENV === 'production'
): void {
  if (resolved.newAnonToken) {
    res.headers.append('Set-Cookie', anonCookieHeader(resolved.newAnonToken, secure));
  }
}
