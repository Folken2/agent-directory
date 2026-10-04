import type { ApiErrorCode } from '../api-error';
import type { Identity, ResolvedIdentity } from '../identity';
import type { Bucket, BucketResult, Reservation } from '../limits/limiter';
import { buildLink, type BuildConfig } from './config';
import { buildLinkEmail } from './email';
import type { OwnerNotification } from './notify';
import { buildSaveBuckets, validateBuildRequest } from './request';
import type { SendLinkArgs, SendOutcome } from './sender';
import type { BuildToken } from './token';
import type { Build, NewBuildSave, SessionBuildLookup, ZipLookup } from './types';

const NO_BUILD = "This chat doesn't have a packaged agent yet. Ask the builder to build it first.";
const ZIP_GONE = 'The zip is no longer on the server (the builder restarted). Ask the builder to package it again.';
const TOO_LARGE = 'This build is too large to email.';
const SEND_FAILED = "We couldn't send the email. Try again in a moment.";
const LIMIT = "You've emailed the maximum number of builds for today.";

/** Everything POST /api/builds touches, injected so the flow is testable without Next, ADK, Postgres or Resend. */
export type SaveBuildDeps = {
  config: BuildConfig;
  /** Base for the link when NEXT_PUBLIC_BASE_URL is unset. */
  origin: string;
  dbEnabled(): boolean;
  resolveIdentity(): Promise<ResolvedIdentity>;
  adkUserId(identity: Identity, sessionId: string): Promise<string>;
  reserve(buckets: Bucket[]): Promise<BucketResult>;
  release(reservation: Reservation): Promise<void>;
  loadBuild(adkUserId: string, sessionId: string): Promise<SessionBuildLookup>;
  fetchZip(adkUserId: string, sessionId: string, build: Build): Promise<ZipLookup>;
  store: {
    insert(record: NewBuildSave): Promise<{ id: string }>;
    markEmailSent(id: string): Promise<void>;
    markNotified(id: string): Promise<void>;
    /** Hard delete; used when the email could not be sent. */
    delete(id: string): Promise<void>;
  };
  newToken(): BuildToken;
  sendLink(args: SendLinkArgs): Promise<SendOutcome>;
  /** Adds an opted-in contact; must never throw. */
  addContact(email: string): Promise<unknown>;
  /** false when no webhook is configured; throws on failure. */
  notify(n: OwnerNotification): Promise<boolean>;
  now?(): Date;
  log?: Pick<Console, 'warn' | 'error'>;
};

export type SaveBuildData = { id: string; sent: boolean; bookingUrl?: string; link?: string };

export type SaveBuildResult = { resolved: ResolvedIdentity | null } & (
  | { ok: true; data: SaveBuildData }
  | { ok: false; code: ApiErrorCode; message?: string; log?: unknown }
);

function fail(resolved: ResolvedIdentity | null, code: ApiErrorCode, message?: string, log?: unknown): SaveBuildResult {
  return { resolved, ok: false, code, message, log };
}

/**
 * Steps 2-11 of POST /api/builds (the route does the cross-origin guard and
 * JSON parsing). Logs carry ids and reasons only, never the email or zip.
 */
export async function handleSaveBuild(body: unknown, deps: SaveBuildDeps): Promise<SaveBuildResult> {
  const log = deps.log ?? console;

  const parsed = validateBuildRequest(body);
  if (!parsed.ok) {
    return fail(null, 'invalid_input', parsed.reason === 'email' ? 'Please enter a valid email address.' : undefined, `invalid ${parsed.reason}`);
  }
  if (!deps.dbEnabled()) return fail(null, 'temporarily_unavailable', undefined, 'no database');

  // A link emailed to a third party must not take its host from the (spoofable) request origin.
  // The origin fallback is for dev mode only, where the link is shown to the requester.
  if (deps.config.email && !deps.config.baseUrl) return fail(null, 'temporarily_unavailable', undefined, 'email configured without a base URL');

  const { email, sessionId, updates, help } = parsed.value;
  const resolved = await deps.resolveIdentity();
  const reservation = await deps.reserve(buildSaveBuckets(resolved.identity, deps.config.limits));
  if (!reservation.ok) {
    return reservation.reason === 'limit'
      ? fail(resolved, 'rate_limited', LIMIT)
      : fail(resolved, 'temporarily_unavailable', undefined, 'limiter unavailable');
  }
  const failAndRelease = async (code: ApiErrorCode, message?: string, why?: unknown) => {
    await deps.release(reservation.reservation);
    return fail(resolved, code, message, why);
  };

  try {
    // The caller's own session: the ADK user id comes from identity, never the client.
    const adkUserId = await deps.adkUserId(resolved.identity, sessionId);
    const lookup = await deps.loadBuild(adkUserId, sessionId);
    if (lookup.kind === 'missing') return await failAndRelease('not_found', NO_BUILD, 'no build in session');
    if (lookup.kind === 'unavailable') return await failAndRelease('backend_unavailable', undefined, 'session lookup failed');
    const build = lookup.build;
    if (build.bytes > deps.config.maxZipBytes) return await failAndRelease('invalid_input', TOO_LARGE, 'zip too large');

    const zip = await deps.fetchZip(adkUserId, sessionId, build);
    if (zip.kind === 'gone') return await failAndRelease('gone', ZIP_GONE, 'artifact gone');
    if (zip.kind === 'unavailable') return await failAndRelease('backend_unavailable', undefined, 'artifact fetch failed');
    if (zip.bytes.length > deps.config.maxZipBytes) return await failAndRelease('invalid_input', TOO_LARGE, 'zip too large');

    const now = (deps.now ?? (() => new Date()))();
    const token = deps.newToken();
    const { id } = await deps.store.insert({
      tokenHash: token.hash,
      email,
      userId: resolved.identity.kind === 'user' ? resolved.identity.userId : null,
      sessionId,
      build,
      zip: zip.bytes,
      updatesConsentAt: updates ? now : null,
      helpRequested: help,
    });

    const link = buildLink(deps.config.baseUrl ?? deps.origin, token.token);
    const sent = await deps.sendLink({ saveId: id, to: email, link, message: buildLinkEmail(build, link) });
    // Drop the row (and its zip) so failed attempts cannot accumulate storage for free.
    if (sent.kind === 'failed') {
      try {
        await deps.store.delete(id);
      } catch (e) {
        log.warn(`[builds] could not delete unsent row id=${id} error=${e instanceof Error ? e.name : 'unknown'}`);
      }
      return await failAndRelease('temporarily_unavailable', SEND_FAILED, `send failed id=${id} reason=${sent.reason}`);
    }
    if (sent.kind === 'sent') {
      try {
        await deps.store.markEmailSent(id);
      } catch {
        log.warn(`[builds] could not mark email sent id=${id}`);
      }
    }

    if (updates) await deps.addContact(email);

    try {
      const notified = await deps.notify({ id, email, signedIn: resolved.identity.kind === 'user', build, updates, help });
      if (notified) await deps.store.markNotified(id);
    } catch {
      log.warn(`[builds] owner notification failed id=${id}`);
    }

    const data: SaveBuildData = { id, sent: sent.kind === 'sent' };
    if (help && deps.config.bookingUrl) data.bookingUrl = deps.config.bookingUrl;
    if (sent.kind === 'dev') data.link = link;
    return { resolved, ok: true, data };
  } catch (error) {
    // The error may echo inserted values; log only its type.
    return failAndRelease('internal', undefined, error instanceof Error ? error.name : 'unknown');
  }
}
