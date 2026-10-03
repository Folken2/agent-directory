import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent, scrubSpan } from './lib/sentry-scrub';

const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
  sendDefaultPii: false,
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSendSpan: scrubSpan,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
