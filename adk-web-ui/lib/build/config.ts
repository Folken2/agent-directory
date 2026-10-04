import type { BuildSaveLimits } from './request';

/**
 * Every deployment-specific value of "Email me my build" comes from env
 * (documented in adk-web-ui/env.example). Nothing here names a domain,
 * sender, site URL, booking link or segment.
 */
export const DEFAULT_MAX_ZIP_BYTES = 10 * 1024 * 1024;

type Env = Record<string, string | undefined>;

export type BuildEmailConfig = { apiKey: string; from: string; replyTo: string | null };

export type BuildConfig = {
  /** null = dev mode: no email provider; the link is logged and returned. */
  email: BuildEmailConfig | null;
  segmentId: string | null;
  maxZipBytes: number;
  webhook: { url?: string; secret?: string };
  bookingUrl: string | null;
  /** NEXT_PUBLIC_BASE_URL without a trailing slash; null = use the request origin. */
  baseUrl: string | null;
  limits: BuildSaveLimits;
};

function value(env: Env, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

function positiveInt(env: Env, names: string[], fallback: number): number {
  const raw = value(env, ...names);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Only https booking links are shown to visitors. */
export function safeBookingUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeBaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function buildConfig(env: Env = process.env): BuildConfig {
  const apiKey = value(env, 'RESEND_API_KEY');
  const from = value(env, 'BUILD_EMAIL_FROM');
  // The secret belongs to whichever webhook URL is used.
  const webhook = value(env, 'BUILD_WEBHOOK_URL')
    ? { url: value(env, 'BUILD_WEBHOOK_URL'), secret: value(env, 'BUILD_WEBHOOK_SECRET') }
    : { url: value(env, 'BLUEPRINT_WEBHOOK_URL'), secret: value(env, 'BLUEPRINT_WEBHOOK_SECRET') };
  return {
    email: apiKey && from ? { apiKey, from, replyTo: value(env, 'BUILD_EMAIL_REPLY_TO') ?? null } : null,
    segmentId: value(env, 'RESEND_SEGMENT_ID') ?? null,
    maxZipBytes: positiveInt(env, ['BUILD_MAX_ZIP_BYTES'], DEFAULT_MAX_ZIP_BYTES),
    webhook,
    bookingUrl: safeBookingUrl(value(env, 'BUILD_BOOKING_URL', 'BLUEPRINT_BOOKING_URL')),
    baseUrl: safeBaseUrl(value(env, 'NEXT_PUBLIC_BASE_URL')),
    limits: {
      user: positiveInt(env, ['BUILD_SAVE_USER_DAILY', 'BLUEPRINT_SAVE_USER_DAILY'], 10),
      anon: positiveInt(env, ['BUILD_SAVE_ANON_DAILY', 'BLUEPRINT_SAVE_ANON_DAILY'], 3),
      anonIp: positiveInt(env, ['BUILD_SAVE_ANON_IP_DAILY', 'BLUEPRINT_SAVE_ANON_IP_DAILY'], 10),
    },
  };
}

export function buildLink(base: string, token: string): string {
  return `${base}/builds/${token}`;
}
