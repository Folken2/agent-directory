import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend(event) {
    // Never ship chat content or cookies.
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
    }
    return event;
  },
});
