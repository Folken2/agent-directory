import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent, scrubSpan } from './lib/sentry-scrub';

const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
  sendDefaultPii: false,
  // Never attach sentry-trace/baggage headers to outgoing requests (backend, Google, database).
  tracePropagationTargets: [],
  integrations: [
    // Stop collecting request bodies and cookies at the source.
    Sentry.requestDataIntegration({ include: { cookies: false, data: false } }),
    // Keep the Next.js SDK default of no duplicate incoming-request spans.
    Sentry.httpIntegration({ disableIncomingRequestSpans: true, maxIncomingRequestBodySize: 'none' }),
  ],
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSendSpan: scrubSpan,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
