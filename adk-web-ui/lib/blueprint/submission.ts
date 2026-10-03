import type { Blueprint } from './types';
import { parseBlueprint } from './parse';
import type { Bucket } from '../limits/limiter';

/** Limiter identity (structurally lib/identity.ts `Identity`). */
type Identity =
  | { kind: 'user'; userId: string }
  | { kind: 'anon'; anonToken: string; ipHash: string | null };

export type BlueprintSubmissionInput = {
  email: string;
  blueprint: Blueprint;
  sessionId: string | null;
};

export type ValidationResult = { ok: true; value: BlueprintSubmissionInput } | { ok: false; reason: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_EMAIL = 254;

/** Validate a POST /api/blueprints body. Reasons are safe to log (no PII). */
export function validateSubmission(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'body' };
  const b = body as Record<string, unknown>;
  if (b.consent !== true) return { ok: false, reason: 'consent' };
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return { ok: false, reason: 'email' };
  const blueprint = parseBlueprint(b.blueprint);
  if (!blueprint) return { ok: false, reason: 'blueprint' };
  let sessionId: string | null = null;
  if (b.sessionId !== undefined && b.sessionId !== null) {
    if (typeof b.sessionId !== 'string' || !SESSION_RE.test(b.sessionId)) return { ok: false, reason: 'session' };
    sessionId = b.sessionId;
  }
  return { ok: true, value: { email, blueprint, sessionId } };
}

/** Daily save buckets; keys share the `bp:` prefix that Sentry scrubbing redacts. */
export function submissionBuckets(identity: Identity, limits = { user: 10, anon: 3, anonIp: 10 }): Bucket[] {
  if (identity.kind === 'user') return [{ key: `bp:u:${identity.userId}`, limit: limits.user }];
  const buckets: Bucket[] = [{ key: `bp:a:${identity.anonToken}`, limit: limits.anon }];
  if (identity.ipHash) buckets.push({ key: `bp:ip:${identity.ipHash}`, limit: limits.anonIp });
  return buckets;
}

/** Only https booking links are shown to visitors. */
export function safeBookingUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export type SubmissionRecord = BlueprintSubmissionInput & { userId: string | null; consentAt: Date };

export type SubmissionDeps = {
  store(record: SubmissionRecord): Promise<{ id: string }>;
  /** Owner notification; failures are reported but never fail the save. */
  notify(record: SubmissionRecord & { id: string }): Promise<void>;
  now?: () => Date;
};

export async function saveSubmission(
  input: BlueprintSubmissionInput,
  identity: Identity,
  deps: SubmissionDeps,
): Promise<{ id: string; notified: boolean }> {
  const record: SubmissionRecord = {
    ...input,
    userId: identity.kind === 'user' ? identity.userId : null,
    consentAt: (deps.now ?? (() => new Date()))(),
  };
  const { id } = await deps.store(record);
  try {
    await deps.notify({ ...record, id });
    return { id, notified: true };
  } catch {
    return { id, notified: false };
  }
}
