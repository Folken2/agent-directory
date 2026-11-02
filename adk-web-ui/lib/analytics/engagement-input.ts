/**
 * Validation for `/api/analytics/engagement` bodies. Pure, so it is unit-tested.
 *
 * Two kinds of events:
 *   - Funnel clicks (opening an agent, starting the builder, contact clicks…)
 *     carry no identifier of their own and follow the pageview rule: recorded
 *     without consent as cookieless aggregates, with `ad_vid` and the user id
 *     only after consent.
 *   - Active-use events (messages, tool calls, dwell heartbeats) are consent-only.
 */

export const CONSENT_ONLY_EVENTS = ['message_sent', 'tool_call', 'heartbeat'] as const;

export const FUNNEL_EVENTS = [
  'agent_open',
  'try_agent',
  'try_prompt',
  'adapt_agent',
  'guide_click',
  'builder_start',
  'build_emailed',
  'copy_page',
  'contact_click',
] as const;

/** `/contact` reports each channel as `contact_<label>` (contact_email, contact_github…). */
const CONTACT_CHANNEL = /^contact_[a-z]{2,20}$/;

export type EngagementEventType = string;

export const MAX_BODY_BYTES = 4096;
export const MAX_METADATA_BYTES = 1024;
const MAX_METADATA_KEYS = 10;
const MAX_METADATA_STRING = 200;
const MAX_DURATION_MS = 10 * 60 * 1000;

const SLUG = /^[A-Za-z0-9_-]{1,100}$/;
const META_KEY = /^[a-z][a-z0-9_]{0,31}$/;
const VISIT_KEY = /^[A-Za-z0-9-]{8,64}$/;

export function isConsentOnlyEvent(type: string): boolean {
  return (CONSENT_ONLY_EVENTS as readonly string[]).includes(type);
}

export function isFunnelEvent(type: string): boolean {
  return (FUNNEL_EVENTS as readonly string[]).includes(type) || CONTACT_CHANNEL.test(type);
}

export type EngagementBody = {
  eventType: string;
  agentSlug: string | null;
  path: string;
  sessionKey: string | null;
  durationMs: number | null;
  metadata: Record<string, string | number | boolean> | null;
};

export type ParseResult =
  | { ok: true; value: EngagementBody }
  | { ok: false; error: string };

function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  const path = value.split(/[?#]/)[0];
  return path.length <= 512 ? path : null;
}

function cleanMetadata(
  raw: unknown
): { ok: true; value: Record<string, string | number | boolean> | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'invalid_metadata' };
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_METADATA_KEYS) return { ok: false, error: 'metadata_too_large' };
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of entries) {
    if (!META_KEY.test(key)) return { ok: false, error: 'invalid_metadata' };
    if (value === undefined || value === null) continue;
    if (typeof value === 'string') out[key] = value.slice(0, MAX_METADATA_STRING);
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else return { ok: false, error: 'invalid_metadata' };
  }
  if (new TextEncoder().encode(JSON.stringify(out)).length > MAX_METADATA_BYTES) {
    return { ok: false, error: 'metadata_too_large' };
  }
  return { ok: true, value: Object.keys(out).length ? out : null };
}

/** `fallbackPath` is used when the body has no valid path (e.g. the Referer path). */
export function parseEngagementBody(raw: unknown, fallbackPath = '/'): ParseResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'invalid_json' };
  const body = raw as Record<string, unknown>;

  const eventType = typeof body.eventType === 'string' ? body.eventType : '';
  if (!isConsentOnlyEvent(eventType) && !isFunnelEvent(eventType)) {
    return { ok: false, error: 'invalid_event' };
  }

  const agentSlug =
    typeof body.agentSlug === 'string' && SLUG.test(body.agentSlug) ? body.agentSlug : null;
  const sessionKey =
    typeof body.sessionKey === 'string' && body.sessionKey.length <= 100 ? body.sessionKey : null;
  const durationMs =
    typeof body.durationMs === 'number' &&
    Number.isInteger(body.durationMs) &&
    body.durationMs >= 0 &&
    body.durationMs <= MAX_DURATION_MS
      ? body.durationMs
      : null;

  const meta = cleanMetadata(body.metadata);
  if (!meta.ok) return meta;
  let metadata = meta.value;
  // The visit's landing page and random visit key ride along so the ops
  // funnel can credit the landing page and count each visit once.
  const landing = cleanPath(body.landing);
  if (landing) metadata = { ...(metadata ?? {}), landing };
  if (typeof body.visit === 'string' && VISIT_KEY.test(body.visit)) {
    metadata = { ...(metadata ?? {}), visit: body.visit };
  }

  return {
    ok: true,
    value: {
      eventType,
      agentSlug,
      path: cleanPath(body.path) ?? cleanPath(fallbackPath) ?? '/',
      sessionKey,
      durationMs,
      metadata,
    },
  };
}
