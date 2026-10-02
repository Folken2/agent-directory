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
 */
export async function adkUserIdForSession(
  identity: Identity,
  sessionId: string,
  findOwned: (key: string, sessionId: string) => Promise<string | null>
): Promise<string> {
  try {
    const owned = await findOwned(identityKey(identity), sessionId);
    if (owned) return owned;
  } catch (error) {
    console.error('[identity] session ownership lookup failed', error);
  }
  return defaultAdkUserId(identity);
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
