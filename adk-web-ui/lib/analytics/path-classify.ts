/**
 * Classifies request paths recorded in `page_views`.
 *
 * Why this exists: 503 distinct paths have been recorded, but only ~20 are real
 * routes. The rest are credential and vulnerability scans (`/.env`,
 * `/wp-config.php.bak`, hundreds of one-off `.php` probes). Those scanners spoof
 * browser user-agents, so `is_bot` stays false and they silently inflate every
 * "human" number — 558 of 1,565 human views on 2026-08-03.
 *
 * Rather than blocklisting hostile patterns (endless, always behind), we
 * allowlist the routes the app actually serves and classify everything else.
 * Non-routes split into three buckets because they mean different things:
 *
 *   - `scanner` — hostile probe. Exclude from traffic reporting entirely.
 *   - `infra`   — well-known / crawler plumbing. Neither a page nor an attack.
 *   - `missing` — plausible page a human asked for and didn't get (`/terms`,
 *                 `/help`). Candidate demand for a page we don't have.
 *
 * A single `missing` hit is not evidence. Measured on 2026-08-03, the 404s are
 * dominated by a contact-page scraper walking locales (`/kontakt`, `/contacto`,
 * `/contatti`, `/impressum`, `/get-in-touch`), one hit each. Callers must
 * require repeat hits from distinct visitors before treating a missing path as
 * demand — see `MIN_MISSING_PAGE_*` in `signals.ts`.
 */

export type PathKind = 'page' | 'infra' | 'scanner' | 'missing';

/**
 * Static routes served by `app/**​/page.tsx`. Kept in sync by
 * `path-classify.test.ts`, which fails if a route is added or removed without
 * updating this list.
 */
export const KNOWN_STATIC_ROUTES: readonly string[] = [
  '/',
  '/about',
  '/analytics',
  '/analytics/ops',
  '/auth/signin',
  '/chat',
  '/contribute',
  '/contribute/submit',
  '/learn',
  '/me/sessions',
  '/privacy',
  '/settings',
  '/settings/connections',
  '/settings/keys',
  '/trending',
] as const;

/** Dynamic route patterns, anchored. Only `/agents/[name]` today. */
const DYNAMIC_ROUTES: readonly RegExp[] = [/^\/agents\/[A-Za-z0-9_-]+$/];

/** Crawler and browser plumbing — expected, but not a page. */
const INFRA_PATHS: readonly string[] = [
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/manifest.json',
  '/manifest.webmanifest',
  '/opensearch.xml',
  '/ads.txt',
  '/security.txt',
];

const INFRA_PREFIXES: readonly string[] = ['/.well-known/', '/_next/', '/api/'];

/**
 * Hostile-probe markers. Checked only for paths that are not known routes, so a
 * legitimate route is never misread as an attack.
 */
const SCANNER_SUBSTRINGS: readonly string[] = [
  '/.git',
  '/.env',
  '/.svn',
  '/.hg',
  '/.aws',
  '/.ssh',
  '/.azure',
  '/.gcloud',
  '/.docker',
  '/.kube',
  '/.vscode',
  '/.idea',
  '/.openai',
  '/.anthropic',
  '/.openclaw',
  '/.npmrc',
  '/.htaccess',
  '/.htpasswd',
  '/.ds_store',
  'wp-config',
  'wp-content',
  'wp-admin',
  'wp-includes',
  'wp-json',
  'wp-login',
  'phpmyadmin',
  'phpinfo',
  '_profiler',
  '_ignition',
  '/cgi-bin',
  '/vendor/',
  '/secrets',
  '/credentials',
  '/service-account',
  '/client_secret',
  '/api-keys',
  '/keyfile',
  '/terraform.tfvars',
  '/terraform.tfstate',
  '/appsettings.json',
  '/web.config',
  '/swagger',
  '/actuator',
  '/eval-stdin',
  '/telescope',
  '/debug/',
  '/kube/',
  '/cloud-init',
];

/**
 * Extensionless dependency and tooling files scanners probe by exact name.
 * Matched exactly so a future `/console` or `/exec` *page* would need adding to
 * KNOWN_STATIC_ROUTES rather than being silently swallowed.
 */
const SCANNER_EXACT_PATHS: readonly string[] = [
  '/env',
  '/exec',
  '/console',
  '/shell',
  '/graphql',
  '/graphiql',
  '/pipfile',
  '/pipfile.lock',
  '/gemfile',
  '/gemfile.lock',
  '/procfile',
  '/dockerfile',
  '/docker-compose.yml',
  '/requirements.txt',
  '/composer.json',
  '/composer.lock',
  '/package.json',
  '/package-lock.json',
  '/yarn.lock',
];

/**
 * Extensions no page of ours ever serves. `.php` dominates, but scanners also
 * probe config and key files by extension.
 */
const SCANNER_EXTENSIONS: readonly string[] = [
  'php',
  'php7',
  'phtml',
  'asp',
  'aspx',
  'jsp',
  'cgi',
  'pl',
  'sh',
  'bak',
  'old',
  'save',
  'orig',
  'swp',
  'sql',
  'sqlite',
  'db',
  'log',
  'ini',
  'conf',
  'config',
  'yml',
  'yaml',
  'toml',
  'tfvars',
  'tfstate',
  'pem',
  'key',
  'enc',
  'p12',
  'pfx',
  'jks',
  'keystore',
  'py',
  'rb',
  'java',
  'jar',
  'war',
  'zip',
  'tar',
  'gz',
  'rar',
  '7z',
  'json',
  'xml',
  'yamlc',
];

/** A path a human might plausibly have typed or followed: no extension, short. */
const PLAUSIBLE_PAGE_RE = /^\/[a-z0-9]+(?:[-/][a-z0-9]+)*\/?$/;
const PLAUSIBLE_PAGE_MAX_LENGTH = 40;

/** Strips query/hash and the trailing slash, preserving case for agent slugs. */
export function normalizePath(rawPath: string): string {
  if (!rawPath) return '/';
  let path = rawPath.split('#')[0].split('?')[0];
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

export function isKnownRoute(rawPath: string): boolean {
  const path = normalizePath(rawPath);
  if (KNOWN_STATIC_ROUTES.includes(path)) return true;
  return DYNAMIC_ROUTES.some((re) => re.test(path));
}

function isInfraPath(path: string): boolean {
  const lower = path.toLowerCase();
  if (INFRA_PATHS.includes(lower)) return true;
  return INFRA_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function hasScannerExtension(lowerPath: string): boolean {
  // Trailing junk is common in probes (`.php~`, `.php.bak`, `.env.production`),
  // so test every dot-segment rather than only the last one.
  const segments = lowerPath.split('/').pop()?.split('.') ?? [];
  return segments
    .slice(1)
    .some((segment) => SCANNER_EXTENSIONS.includes(segment.replace(/[^a-z0-9]/g, '')));
}

function isScannerPath(path: string): boolean {
  const lower = path.toLowerCase();
  if (SCANNER_EXACT_PATHS.includes(lower)) return true;
  if (SCANNER_SUBSTRINGS.some((needle) => lower.includes(needle))) return true;
  return hasScannerExtension(lower);
}

/**
 * Four-way classification. Known routes win outright; only unrecognised paths
 * are tested against hostile patterns.
 */
export function classifyPath(rawPath: string): PathKind {
  const path = normalizePath(rawPath);
  if (isKnownRoute(path)) return 'page';
  if (isInfraPath(path)) return 'infra';
  if (isScannerPath(path)) return 'scanner';

  const lower = path.toLowerCase();
  if (lower.length <= PLAUSIBLE_PAGE_MAX_LENGTH && PLAUSIBLE_PAGE_RE.test(lower)) {
    return 'missing';
  }
  return 'scanner';
}

/** True for real pages only — the predicate page reporting should filter on. */
export function isPageView(rawPath: string): boolean {
  return classifyPath(rawPath) === 'page';
}

/**
 * SQL-ready list of `NOT LIKE` fragments is deliberately absent: classification
 * is richer than SQL patterns express cleanly, so callers select paths and
 * classify in TypeScript. Path cardinality is in the hundreds, so this is cheap.
 */
