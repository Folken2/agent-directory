/**
 * Search Console API client for the ops panel: clicks, impressions, CTR and
 * position by query and by page. Optional — without credentials it returns a
 * setup hint and never throws to the UI.
 *
 * Auth is a service-account JWT exchanged for an access token (RS256 signed
 * with Node's crypto), so no Google SDK is needed. Add the service account's
 * email as a user on the Search Console property.
 */

import { createSign } from 'crypto';
import { unstable_cache } from 'next/cache';

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const GSC_DEFAULT_SITE = 'sc-domain:agentdirectory.folch.ai';
export const GSC_WINDOWS = [28, 90] as const;
export type GscWindow = (typeof GSC_WINDOWS)[number];

const CACHE_SECONDS = 6 * 60 * 60;
const ROW_LIMIT = 50;

export type GscRow = {
  key: string;
  clicks: number;
  impressions: number;
  /** 0–1 */
  ctr: number;
  position: number;
};

export type GscReport = {
  configured: boolean;
  setupHint?: string;
  error?: string;
  site: string;
  days: GscWindow;
  startDate: string;
  endDate: string;
  totals: Omit<GscRow, 'key'> | null;
  queries: GscRow[];
  pages: GscRow[];
};

type ServiceAccount = { client_email: string; private_key: string };

export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') return null;
    // Env UIs often store the key with literal "\n" sequences.
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

/**
 * The last `days` complete days, ending yesterday (UTC). Search Console data
 * lags a day or two; the newest days fill in on later refreshes.
 */
export function gscDateRange(days: number, now: Date = new Date()): { startDate: string; endDate: string } {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: GSC_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${base64url(signer.sign(account.private_key))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`token exchange failed (${res.status})`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('token exchange returned no access_token');
  return json.access_token;
}

type ApiRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

function toRow(r: ApiRow): GscRow {
  return {
    key: r.keys?.[0] ?? '',
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
    position: Number(r.position ?? 0),
  };
}

async function query(
  token: string,
  site: string,
  body: Record<string, unknown>
): Promise<ApiRow[]> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error(`searchAnalytics.query failed (${res.status})`);
  const json = (await res.json()) as { rows?: ApiRow[] };
  return json.rows ?? [];
}

function emptyReport(site: string, days: GscWindow, partial: Partial<GscReport>): GscReport {
  return {
    configured: false,
    site,
    days,
    ...gscDateRange(days),
    totals: null,
    queries: [],
    pages: [],
    ...partial,
  };
}

/** Throws on API failure so errors are never cached for six hours. */
const fetchCached = unstable_cache(
  async (site: string, days: GscWindow): Promise<GscReport> => {
    const account = parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON);
    if (!account) throw new Error('not configured');
    const token = await accessToken(account);
    const range = gscDateRange(days);
    const base = { ...range, type: 'web', dataState: 'all' };
    const [totals, queries, pages] = await Promise.all([
      query(token, site, base),
      query(token, site, { ...base, dimensions: ['query'], rowLimit: ROW_LIMIT }),
      query(token, site, { ...base, dimensions: ['page'], rowLimit: ROW_LIMIT }),
    ]);
    const total = totals[0] ? toRow(totals[0]) : null;
    return {
      configured: true,
      site,
      days,
      ...range,
      totals: total
        ? { clicks: total.clicks, impressions: total.impressions, ctr: total.ctr, position: total.position }
        : { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      queries: queries.map(toRow),
      pages: pages.map(toRow),
    };
  },
  ['search-console-v1'],
  { revalidate: CACHE_SECONDS }
);

export async function fetchSearchConsoleReport(days: GscWindow): Promise<GscReport> {
  const site = process.env.GSC_SITE_URL || GSC_DEFAULT_SITE;
  if (!parseServiceAccount(process.env.GSC_SERVICE_ACCOUNT_JSON)) {
    return emptyReport(site, days, {
      setupHint:
        'Search Console is not configured. Set GSC_SERVICE_ACCOUNT_JSON to a service-account key and add that account as a user on the Search Console property.',
    });
  }
  try {
    return await fetchCached(site, days);
  } catch (error) {
    console.error('[analytics] search console fetch failed', error);
    return emptyReport(site, days, {
      configured: true,
      error: 'Search Console request failed. Check that the service account has access to the property.',
    });
  }
}
