import type { NextConfig } from "next";
import { join } from "path";
import { withSentryConfig } from "@sentry/nextjs/config";

const isProd = process.env.NODE_ENV === 'production';
const GEOIP_DATA = './node_modules/fast-geoip/data/**/*';

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://www.googletagmanager.com https://maps.googleapis.com`,
  // fonts.googleapis.com / fonts.gstatic.com: Google Maps JS API UI fonts (the app's own fonts are self-hosted).
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://maps.googleapis.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
  "frame-src https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
];

if (process.env.CSP_REPORT_URI) {
  cspDirectives.push(`report-uri ${process.env.CSP_REPORT_URI}`);
}

const csp = cspDirectives.join('; ');

const securityHeaders = [
  {
    key: process.env.CSP_ENFORCE === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
    value: csp,
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  // Include monorepo root so the standalone bundle carries agents/*/metadata.json.
  outputFileTracingRoot: join(__dirname, '..'),
  // Dynamic fs reads of agents/*/metadata.json are not always traced — pin them.
  // fast-geoip's ~157 MB data is only needed off Vercel (Vercel sends geo
  // headers, so the lookup never runs there) and would crowd its function
  // size limit, so it is pinned off Vercel and excluded on Vercel.
  outputFileTracingIncludes: {
    '/api/agents': ['../agents/**/metadata.json'],
    ...(process.env.VERCEL ? {} : { '/api/analytics/pageview': [GEOIP_DATA] }),
  },
  ...(process.env.VERCEL
    ? { outputFileTracingExcludes: { '/api/analytics/pageview': [GEOIP_DATA] } }
    : {}),
  serverExternalPackages: ['fast-geoip'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'www.google.com', pathname: '/**' },
      { protocol: 'https', hostname: 'exa.ai', pathname: '/**' },
      { protocol: 'https', hostname: 'github.githubassets.com', pathname: '/**' },
      { protocol: 'https', hostname: 'mermaid.js.org', pathname: '/**' },
      { protocol: 'https', hostname: 'tavily.com', pathname: '/**' },
      { protocol: 'https', hostname: 'xquik.com', pathname: '/**' },
      { protocol: 'https', hostname: 'img.youtube.com', pathname: '/**' },
      { protocol: 'https', hostname: 'yt3.ggpht.com', pathname: '/**' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com', pathname: '/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
