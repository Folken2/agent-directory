/**
 * Pure roll-up math for the retention job (lib/analytics/retention.ts).
 * Raw rows for one UTC day in, one row per distinct dimension set out.
 */

export const RAW_RETENTION_DAYS = 90;
export const TRANSCRIPT_RETENTION_DAYS = 30;

export type RawPageViewRow = {
  day: string;
  path: string;
  isBot: boolean;
  botName: string | null;
  country: string | null;
  deviceType: string | null;
  referrer: string | null;
};

export type PageViewDailyRow = {
  day: string;
  path: string;
  isBot: boolean;
  botName: string;
  country: string;
  deviceType: string;
  refHost: string;
  views: number;
};

export type RawEngagementRow = {
  day: string;
  eventType: string;
  agentSlug: string | null;
  path: string;
  visitorId: string;
  durationMs: number | null;
  metadata: string | null;
};

export type EngagementDailyRow = {
  day: string;
  eventType: string;
  agentSlug: string;
  path: string;
  landingPath: string;
  events: number;
  visits: number;
  durationMs: number;
};

/** Raw rows created before this instant are rolled up and deleted. */
export function rawCutoff(now: Date = new Date(), days = RAW_RETENTION_DAYS): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/**
 * Anonymous chats last touched before this instant are deleted, and ops never
 * shows message content older than this, for anyone.
 */
export function transcriptCutoff(now: Date = new Date(), days = TRANSCRIPT_RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** ADK user id prefix for signed-in chats (see `defaultAdkUserId` in lib/identity.ts). */
export const SIGNED_IN_ADK_PREFIX = 'u_';
/** Pre-identity sessions all share this id; their owner is known from agent_run_events. */
export const LEGACY_ADK_USER = 'default-user';

/**
 * Whether an ADK session is a signed-in user's own chat history, which the
 * retention job keeps until the user deletes it. Anonymous chats (`a_…`) are
 * deleted after the transcript window. A legacy `default-user` session counts
 * as signed-in when its runs were made by an authenticated user.
 */
export function isSignedInAdkSession(adkUserId: string, legacyRunAuthenticated = false): boolean {
  if (adkUserId.startsWith(SIGNED_IN_ADK_PREFIX)) return true;
  return adkUserId === LEGACY_ADK_USER && legacyRunAuthenticated;
}

/** Host of a referrer URL, without `www.`; '' when missing or unparsable. */
export function referrerHost(referrer: string | null | undefined): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '').slice(0, 255);
  } catch {
    return '';
  }
}

export function rollUpPageViews(rows: readonly RawPageViewRow[]): PageViewDailyRow[] {
  const acc = new Map<string, PageViewDailyRow>();
  for (const r of rows) {
    const row: PageViewDailyRow = {
      day: r.day,
      path: r.path,
      isBot: r.isBot,
      botName: r.isBot ? (r.botName ?? '') : '',
      country: r.country ?? '',
      deviceType: r.deviceType ?? '',
      refHost: referrerHost(r.referrer),
      views: 0,
    };
    const key = [row.day, row.path, row.isBot, row.botName, row.country, row.deviceType, row.refHost].join('\u0000');
    const hit = acc.get(key) ?? row;
    hit.views += 1;
    acc.set(key, hit);
  }
  return [...acc.values()];
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function rollUpEngagement(rows: readonly RawEngagementRow[]): EngagementDailyRow[] {
  const acc = new Map<string, { row: EngagementDailyRow; visits: Set<string> }>();
  for (const r of rows) {
    const meta = parseMetadata(r.metadata);
    const landingPath = typeof meta.landing === 'string' ? meta.landing : '';
    const visit = typeof meta.visit === 'string' ? meta.visit : r.visitorId;
    const agentSlug = r.agentSlug ?? '';
    const key = [r.day, r.eventType, agentSlug, r.path, landingPath].join('\u0000');
    let entry = acc.get(key);
    if (!entry) {
      entry = {
        row: { day: r.day, eventType: r.eventType, agentSlug, path: r.path, landingPath, events: 0, visits: 0, durationMs: 0 },
        visits: new Set(),
      };
      acc.set(key, entry);
    }
    entry.row.events += 1;
    entry.row.durationMs += r.durationMs ?? 0;
    entry.visits.add(visit);
  }
  return [...acc.values()].map(({ row, visits }) => ({ ...row, visits: visits.size }));
}
