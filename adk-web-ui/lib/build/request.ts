import type { Identity } from '../identity';
import type { Bucket } from '../limits/limiter';

/** The whole POST /api/builds body: the client never sends the build or the zip. */
export type BuildSaveRequest = { email: string; sessionId: string; updates: boolean; help: boolean };

export type BuildRequestResult =
  | { ok: true; value: BuildSaveRequest }
  | { ok: false; reason: 'body' | 'email' | 'session' };

export type BuildSaveLimits = { user: number; anon: number; anonIp: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_EMAIL = 254;

/** Reasons are safe to log (no PII). */
export function validateBuildRequest(body: unknown): BuildRequestResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'body' };
  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return { ok: false, reason: 'email' };
  if (typeof b.sessionId !== 'string' || !SESSION_RE.test(b.sessionId)) return { ok: false, reason: 'session' };
  return { ok: true, value: { email, sessionId: b.sessionId, updates: b.updates === true, help: b.help === true } };
}

/** Daily buckets; the `bd:` prefix is redacted by lib/sentry-scrub.ts. */
export function buildSaveBuckets(identity: Identity, limits: BuildSaveLimits): Bucket[] {
  if (identity.kind === 'user') return [{ key: `bd:u:${identity.userId}`, limit: limits.user }];
  const buckets: Bucket[] = [{ key: `bd:a:${identity.anonToken}`, limit: limits.anon }];
  if (identity.ipHash) buckets.push({ key: `bd:ip:${identity.ipHash}`, limit: limits.anonIp });
  return buckets;
}
