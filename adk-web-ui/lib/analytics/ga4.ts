/**
 * GA4 Data API client for the ops acquisition panel.
 * Optional — missing credentials return a setup hint, never throw to the UI.
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import {
  timelineRangeDays,
  type TimelineRange,
} from './timeline-range';

export type Ga4DimensionRow = {
  value: string;
  sessions: number;
};

export type Ga4AcquisitionReport = {
  configured: boolean;
  setupHint?: string;
  /** Property started 2026-08-03 — history is short. */
  propertyStartedAt: string;
  channelGroup: Ga4DimensionRow[];
  deviceCategory: Ga4DimensionRow[];
  newVsReturning: Ga4DimensionRow[];
  disclaimer: string;
};

const PROPERTY_STARTED = '2026-08-03';

const DISCLAIMER =
  'Consent-only GA4 sample — will not match first-party Neon counts. Property history starts 2026-08-03.';

function emptyReport(
  partial: Partial<Ga4AcquisitionReport> & { configured: boolean }
): Ga4AcquisitionReport {
  return {
    channelGroup: [],
    deviceCategory: [],
    newVsReturning: [],
    propertyStartedAt: PROPERTY_STARTED,
    disclaimer: DISCLAIMER,
    ...partial,
  };
}

function credentialsFromEnv(): object | null {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as object;
  } catch {
    return null;
  }
}

function dateRangeFor(range: TimelineRange): { startDate: string; endDate: string } {
  const days = timelineRangeDays(range);
  if (days === null) {
    return { startDate: PROPERTY_STARTED, endDate: 'today' };
  }
  return { startDate: `${days}daysAgo`, endDate: 'today' };
}

async function runDimensionReport(
  client: BetaAnalyticsDataClient,
  propertyId: string,
  dimension: string,
  range: TimelineRange
): Promise<Ga4DimensionRow[]> {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [dateRangeFor(range)],
    dimensions: [{ name: dimension }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });

  return (response.rows ?? []).map((row) => ({
    value: row.dimensionValues?.[0]?.value || '(not set)',
    sessions: Number(row.metricValues?.[0]?.value || 0),
  }));
}

/**
 * Fetch channel / device / new-vs-returning. Never throws — returns a hint
 * when env is missing or the API fails.
 */
export async function fetchGa4Acquisition(
  range: TimelineRange
): Promise<Ga4AcquisitionReport> {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const credentials = credentialsFromEnv();

  if (!propertyId || !credentials) {
    return emptyReport({
      configured: false,
      setupHint:
        'Set GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_JSON (service account JSON) to enable this panel.',
    });
  }

  try {
    const client = new BetaAnalyticsDataClient({ credentials });
    const [channelGroup, deviceCategory, newVsReturning] = await Promise.all([
      runDimensionReport(client, propertyId, 'sessionDefaultChannelGroup', range),
      runDimensionReport(client, propertyId, 'deviceCategory', range),
      runDimensionReport(client, propertyId, 'newVsReturning', range),
    ]);

    return emptyReport({
      configured: true,
      channelGroup,
      deviceCategory,
      newVsReturning,
    });
  } catch (error) {
    console.error('[analytics] GA4 fetch failed', error);
    return emptyReport({
      configured: false,
      setupHint:
        'GA4 credentials are set but the Data API call failed. Check property access for the service account.',
    });
  }
}
