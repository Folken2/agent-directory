import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeBreadcrumb(breadcrumb) {
    // console output can contain chat/artifact content — never ship it.
    return breadcrumb.category === 'console' ? null : breadcrumb;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
