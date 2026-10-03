import type { Breadcrumb, Event } from '@sentry/nextjs';

/**
 * Pure scrubbers for Sentry payloads. Nothing here may ship chat content,
 * cookies, auth headers or the anonymous session token (which appears in
 * backend URLs as /users/a_<token>/ and in limiter keys as run:a:<token> or
 * bp:a:<token>), nor email addresses from blueprint saves.
 */

const SENSITIVE_HEADERS = new Set(['cookie', 'authorization']);
const URL_ATTRIBUTES = ['url', 'url.full', 'http.url', 'http.target', 'url.path', 'url.query'];

export function redactUrl(value: string): string {
  return value
    .replace(/\/users\/[^/?#\s]+/g, '/users/[redacted]')
    .replace(/(run|bp):(?:a:[0-9a-f]+|ip:[0-9a-f]+|u:[^\s]+)/g, '$1:[redacted]')
    .replace(/[^\s@/?#&=]+@[^\s@/?#&=]+\.[A-Za-z]{2,}/g, '[email]');
}

function redactValue<T>(value: T): T {
  return (typeof value === 'string' ? redactUrl(value) : value) as T;
}

function redactUrlAttributes(data: Record<string, unknown> | undefined): void {
  if (!data) return;
  for (const key of URL_ATTRIBUTES) {
    if (key in data) data[key] = redactValue(data[key]);
  }
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Console output can contain chat content or limiter keys — never ship it.
  if (breadcrumb.category === 'console') return null;
  if (breadcrumb.message) breadcrumb.message = redactUrl(breadcrumb.message);
  if (breadcrumb.data && 'url' in breadcrumb.data) {
    breadcrumb.data.url = redactValue(breadcrumb.data.url);
  }
  return breadcrumb;
}

export function scrubSpan<T extends { description?: string; data?: Record<string, unknown> }>(
  span: T,
): T {
  if (span.description) span.description = redactUrl(span.description);
  redactUrlAttributes(span.data);
  return span;
}

export function scrubEvent<T extends Event>(event: T): T {
  const request = event.request;
  if (request) {
    delete request.data;
    delete request.cookies;
    if (request.headers) {
      for (const key of Object.keys(request.headers)) {
        if (SENSITIVE_HEADERS.has(key.toLowerCase())) delete request.headers[key];
      }
    }
    if (request.url) request.url = redactUrl(request.url);
    if (typeof request.query_string === 'string') {
      request.query_string = redactUrl(request.query_string);
    }
  }
  if (event.transaction) event.transaction = redactUrl(event.transaction);
  if (event.spans) {
    for (const span of event.spans) {
      scrubSpan(span as { description?: string; data?: Record<string, unknown> });
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((b): b is Breadcrumb => b !== null);
  }
  return event;
}
