# Builder "Email me my build" (web app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blueprint card/save flow in `adk-web-ui` with a build card (download the zip) plus an "Email me a permanent link" flow that stores the zip, emails a private `/builds/<token>` link through Resend (or logs/returns it in dev mode), and lets the holder download or delete it; swap the ops analytics and copy to match.

**Architecture:** The stream path the blueprint used (`state_delta` → `adk-client` → `StreamAssembler` → `messagePayloads` → renderer registry) now carries `state["builder:build"]` as a `Build`. Server logic lives in small pure modules under `lib/build/` (parse, config, token, request validation, email body, Resend sender, handlers) that take their I/O as injected dependencies, so they are unit-tested with `node:test` without Next, Postgres or Resend; thin Next route files wire the real dependencies (ADK via `adkFetch`, Postgres via Drizzle, Resend SDK). Zips are stored in a new `build_saves` table (`bytea`), addressed only by the sha256 of a random token.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Drizzle ORM 0.45 on `@neondatabase/serverless` (neon-http), `node:test` + `tsx` for unit tests, Playwright for e2e, `resend` Node SDK (>= 6.9.2; 6.32.0 is current).

**Spec:** `docs/superpowers/specs/2026-10-04-builder-zip-capture-design.md` (this plan covers its "Web app (adk-web-ui)" section, its "Copy" section and the web parts of "Testing"; the Python backend has its own plan).

## Global Constraints

- **Session-state contract (written by the backend plan, read here — copied verbatim from the spec):**

  ```
  builder:build = {
    "name": "research-summarizer", "package": "research_summarizer",
    "description": "...", "options": {...},            # from builder:project
    "models": {"fast": "openrouter/...", "reasoning": "openrouter/..."},
    "tools": ["web_search", ...],                      # modules in <package>/tools/, minus __init__
    "skills": ["sourced-summary", ...],                # dirs under <package>/skills/ with a SKILL.md
    "artifact": "research-summarizer.zip", "version": 0,
    "files": 41, "bytes": 58213, "packagedAt": "2026-10-04T09:12:00Z"
  }
  ```
  - `models` values may be `null`. Each repackage overwrites `builder:build`. At most 50 tools and 50 skills, names truncated to 64 chars.
  - `builder:project = {"description": str, "options": {<scaffold_agent's option params>: bool}}` (backend only; the web reads `options` through `builder:build`). Option keys today: `workflow`, `with_composio`, `with_slack`, `with_telegram`, `with_teams`, `with_acp`, `with_eval`, `persona`.
- **Nothing deployment-specific is hardcoded.** No domain, sender, site URL, booking link or segment id in code, tests' production paths, or copy. Every such value comes from an env var documented in `adk-web-ui/env.example`. Links use `NEXT_PUBLIC_BASE_URL` (falling back to the request origin); the email names the site from that link's host. Limits are env vars with defaults. (Test fixtures may use `*.test` / `example.com` / `localhost`.)
- **Env vars (all optional):** `RESEND_API_KEY`, `BUILD_EMAIL_FROM` (required with the key; without it → dev mode), `BUILD_EMAIL_REPLY_TO`, `BUILD_MAX_ZIP_BYTES` (default 10 MB = 10485760), `RESEND_SEGMENT_ID`, `BUILD_WEBHOOK_URL` / `BUILD_WEBHOOK_SECRET` (fallback `BLUEPRINT_WEBHOOK_URL` / `BLUEPRINT_WEBHOOK_SECRET`), `BUILD_BOOKING_URL` (fallback `BLUEPRINT_BOOKING_URL`, https only), `BUILD_SAVE_USER_DAILY` / `BUILD_SAVE_ANON_DAILY` / `BUILD_SAVE_ANON_IP_DAILY` (fallback `BLUEPRINT_SAVE_*_DAILY`, defaults 10 / 3 / 10).
- **Resend rules:** the Node SDK returns `{ data, error }` and does not throw on API errors — always check `error` (a try/catch is extra, not a substitute). Idempotency key is exactly `build-link/<save id>`. Tests and manual checks send to `delivered@resend.dev` only. Resend is never called from the browser (only from `app/api/builds/route.ts` via `lib/build/resend-client.ts`).
- **Dev mode:** no `RESEND_API_KEY` or no `BUILD_EMAIL_FROM` → the link is logged to the server console and returned in the response as `link`; the dialog shows it.
- **`POST /api/builds` body is exactly** `{email, sessionId, updates: boolean, help: boolean}`. The client never sends the build or the zip.
- **Validation:** email trimmed, lowercased, ≤254 chars, `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; `sessionId` required, `/^[A-Za-z0-9_-]{1,128}$/`.
- **Rate-limit keys:** `bd:u:<userId>`, `bd:a:<anonToken>`, `bd:ip:<ipHash>`.
- **Token:** 32 random bytes, base64url (43 chars). Only `sha256(token)` (hex) is stored.
- **Privacy:** logs carry ids, reasons and error names, never the email, zip or token — except the dev-mode link log line the spec requires. `/builds/*` and `/api/builds/*` send `noindex` and `Referrer-Policy: no-referrer`; `/builds/` paths are never recorded as pageviews; Sentry redacts `bd:` keys and `/builds/<token>`.
- **`blueprint_submissions` stays in the database untouched.** `lib/drizzle/schema/blueprint-submissions.ts` stays (marked legacy) so `drizzle-kit generate` doesn't emit a drop.
- **Copy:** the user-facing strings named in the spec are used verbatim: "Download zip", "Email me a permanent link", "Send me updates about the builder and nuvel", "I'd like help deploying it", "Check your inbox", "Delete this build", "Builds you email yourself", "Got a zip", "Emailed it", "Asked for help".
- **Tooling (run from `adk-web-ui/`):** unit tests are `node:test` via `npm run test:unit` (glob `lib/**/*.test.ts`; single file: `node --import tsx --test <file>`). Test files import siblings with an explicit `.ts` extension and must not import modules that use the `@/` alias. Lint `npm run lint`, typecheck `npx tsc --noEmit`, build `npm run build`, e2e `npm run test:e2e`.
- **Commits:** every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

Created (all paths under `adk-web-ui/`):

| File | Responsibility |
|---|---|
| `lib/build/types.ts` | `Build` type, `BUILD_STATE_KEY`, lookup/record types shared by server modules |
| `lib/build/parse.ts` (+test) | `parseBuild(raw)`: defensive validation of `builder:build` |
| `lib/build/summary.ts` (+test) | Display helpers: option labels, byte/plural formatting, run steps, Markdown, zip file name, single-artifact URL |
| `lib/build/data-url.ts` (+test) | `dataUrlToBytes` for the in-chat download |
| `lib/build/test-fixtures.ts` | Shared `BUILD` fixture for tests (not matched by the test glob) |
| `lib/build/config.ts` (+test) | `buildConfig(env)`: every env var with fallbacks/defaults; `safeBookingUrl`, `buildLink` |
| `lib/build/token.ts` (+test) | Token mint, hash, format check |
| `lib/build/request.ts` (+test) | `validateBuildRequest`, `buildSaveBuckets` |
| `lib/build/email.ts` (+test) | `buildLinkEmail(build, link)` → subject/html/text |
| `lib/build/sender.ts` (+test) | `EmailClient` interface, `sendBuildLink`, `addUpdatesContact` (dev mode, `{error}` handling, idempotency key) |
| `lib/build/resend-client.ts` | Adapts the `resend` SDK to `EmailClient` (server only) |
| `lib/build/notify.ts` (+test) | Owner webhook `build.saved` |
| `lib/build/zip-part.ts` (+test) | Decode an ADK artifact `Part` to bytes |
| `lib/build/adk-build.ts` | Server: read `builder:build` from the caller's ADK session; fetch the zip artifact |
| `lib/build/db-store.ts` | Server: `build_saves` bootstrap + queries |
| `lib/build/save-handler.ts` (+test) | `handleSaveBuild(body, deps)`: steps 2–11 of `POST /api/builds` |
| `lib/build/link-handlers.ts` (+test) | Zip download and delete by token |
| `lib/drizzle/bytea.ts` (+test) | Drizzle `bytea` custom type + driver value normalizer |
| `lib/drizzle/schema/build-saves.ts` | `build_saves` table |
| `drizzle/migrations/0015_build_saves.sql` | Migration |
| `components/build/BuildCard.tsx` | Chat card: summary, Download zip, Email me a permanent link |
| `components/build/download.ts` | Browser helper: fetch single artifact and save it |
| `components/build/EmailBuildDialog.tsx` | Email + two opt-ins dialog |
| `components/build/BuildLinkActions.tsx` | Download + delete buttons on the link page |
| `app/api/builds/route.ts` | `POST /api/builds` |
| `app/api/builds/[token]/route.ts` | `DELETE /api/builds/[token]` |
| `app/api/builds/[token]/zip/route.ts` | `GET /api/builds/[token]/zip` |
| `app/builds/[token]/page.tsx` | Server-rendered link page |
| `e2e/build.spec.ts` | Playwright |

Modified: `lib/types.ts`, `lib/adk-client.ts` (+test), `lib/chat/stream-assembler.ts` (+test), `lib/chat/payloads.ts` (+test), `lib/hooks/useStreamingChat.ts`, `components/chat/renderers/index.tsx`, `lib/api-error.ts` (+test), `lib/drizzle/schema/index.ts`, `lib/drizzle/schema/blueprint-submissions.ts` (legacy note), `drizzle/migrations/meta/_journal.json`, `lib/analytics/should-track.ts` (+test), `next.config.ts`, `lib/analytics/adk-events.ts`, `lib/analytics/conversation-insights.ts` (+test), `lib/analytics/ops-insights.ts`, `lib/analytics/ops-types.ts`, `components/analytics/ops/ConversationsView.tsx`, `components/analytics/ops/InsightsView.tsx`, `lib/sentry-scrub.ts` (+test), `app/privacy/page.tsx`, `app/about/page.tsx`, `env.example`, `package.json` / `package-lock.json`.

Deleted: `lib/blueprint/*`, `components/blueprint/*`, `app/api/blueprints/route.ts`, `e2e/blueprint.spec.ts`.

---

### Task 1: `Build` type, parser and display helpers

**Files:**
- Create: `adk-web-ui/lib/build/types.ts`
- Create: `adk-web-ui/lib/build/parse.ts`
- Create: `adk-web-ui/lib/build/summary.ts`
- Create: `adk-web-ui/lib/build/data-url.ts`
- Create: `adk-web-ui/lib/build/test-fixtures.ts`
- Test: `adk-web-ui/lib/build/parse.test.ts`, `adk-web-ui/lib/build/summary.test.ts`, `adk-web-ui/lib/build/data-url.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BUILD_STATE_KEY = 'builder:build'`
  - `type Build = { name; package; description; options: Record<string, boolean>; models: { fast: string | null; reasoning: string | null }; tools: string[]; skills: string[]; artifact; version: number; files: number; bytes: number; packagedAt: string }`
  - `type NewBuildSave`, `type SessionBuildLookup`, `type ZipLookup` (used by Tasks 3–5)
  - `parseBuild(raw: unknown): Build | null`
  - `optionLabel(key: string): string`, `enabledOptions(build: Pick<Build,'options'>): string[]`, `formatBytes(n): string`, `plural(n, word): string`, `runSteps(artifact: string): string[]`, `buildToMarkdown(build): string`, `zipFileName(projectName): string`, `artifactDownloadUrl(appName, sessionId, build: Pick<Build,'artifact'|'version'>): string`
  - `dataUrlToBytes(url: string): { mimeType: string; bytes: Uint8Array<ArrayBuffer> } | null`
  - `BUILD` fixture in `lib/build/test-fixtures.ts`

- [ ] **Step 1: Write the types and the fixture**

`adk-web-ui/lib/build/types.ts`:

```ts
/**
 * `state["builder:build"]`, written by the builder's package_agent tool
 * (agents/adk_agent_builder/tools/project_tools.py) after each packaging.
 * Each repackage overwrites it.
 */
export const BUILD_STATE_KEY = 'builder:build';

export type BuildModels = { fast: string | null; reasoning: string | null };

export type Build = {
  name: string;
  package: string;
  description: string;
  /** scaffold_agent's option params (with_slack, persona, ...). */
  options: Record<string, boolean>;
  models: BuildModels;
  tools: string[];
  skills: string[];
  /** Artifact name in the ADK session, e.g. "research-summarizer.zip". */
  artifact: string;
  version: number;
  files: number;
  bytes: number;
  packagedAt: string;
};

/** The caller's own ADK session, read server side by POST /api/builds. */
export type SessionBuildLookup = { kind: 'ok'; build: Build } | { kind: 'missing' } | { kind: 'unavailable' };

/** The zip artifact; `gone` means the in-memory artifact service lost it (restart). */
export type ZipLookup = { kind: 'ok'; bytes: Buffer } | { kind: 'gone' } | { kind: 'unavailable' };

/** One `build_saves` insert. */
export type NewBuildSave = {
  tokenHash: string;
  email: string;
  userId: string | null;
  sessionId: string;
  build: Build;
  zip: Buffer;
  updatesConsentAt: Date | null;
  helpRequested: boolean;
};
```

`adk-web-ui/lib/build/test-fixtures.ts`:

```ts
import type { Build } from './types';

/** The spec's example `builder:build`, shared by unit tests. */
export const BUILD: Build = {
  name: 'research-summarizer',
  package: 'research_summarizer',
  description: 'Searches the web for a topic and writes a sourced one-page summary.',
  options: { with_eval: true, with_slack: false, persona: true },
  models: { fast: 'openrouter/google/gemini-2.5-flash', reasoning: null },
  tools: ['web_search'],
  skills: ['sourced-summary'],
  artifact: 'research-summarizer.zip',
  version: 0,
  files: 41,
  bytes: 58213,
  packagedAt: '2026-10-04T09:12:00Z',
};
```

- [ ] **Step 2: Write the failing tests**

`adk-web-ui/lib/build/parse.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBuild } from './parse.ts';
import { BUILD } from './test-fixtures.ts';

describe('parseBuild', () => {
  it('accepts the state shape the backend writes', () => {
    assert.deepEqual(parseBuild(BUILD), BUILD);
  });

  it('fills defaults for optional fields', () => {
    const b = parseBuild({ name: 'x', package: 'x', artifact: 'x.zip', version: 2 });
    assert.ok(b);
    assert.equal(b.description, '');
    assert.deepEqual(b.options, {});
    assert.deepEqual(b.models, { fast: null, reasoning: null });
    assert.deepEqual([b.tools, b.skills, b.files, b.bytes, b.packagedAt], [[], [], 0, 0, '']);
  });

  it('rejects missing or unsafe required fields', () => {
    assert.equal(parseBuild(null), null);
    assert.equal(parseBuild('x'), null);
    assert.equal(parseBuild({ ...BUILD, name: '' }), null);
    assert.equal(parseBuild({ ...BUILD, package: undefined }), null);
    assert.equal(parseBuild({ ...BUILD, artifact: 'x.tar' }), null);
    assert.equal(parseBuild({ ...BUILD, artifact: '../x.zip' }), null);
    assert.equal(parseBuild({ ...BUILD, version: -1 }), null);
    assert.equal(parseBuild({ ...BUILD, version: 1.5 }), null);
  });

  it('caps lists and drops junk instead of failing', () => {
    const b = parseBuild({
      ...BUILD,
      tools: [...Array.from({ length: 60 }, (_, i) => `t${i}`), 7, null],
      skills: ['s'.repeat(80)],
      options: { with_slack: true, persona: 'yes', [`k${'x'.repeat(80)}`]: true },
      models: { fast: 42, reasoning: 'openrouter/x' },
      files: -3,
    });
    assert.ok(b);
    assert.equal(b.tools.length, 50);
    assert.equal(b.skills[0].length, 64);
    assert.deepEqual(b.options, { with_slack: true });
    assert.deepEqual(b.models, { fast: null, reasoning: 'openrouter/x' });
    assert.equal(b.files, 0);
  });
});
```

`adk-web-ui/lib/build/summary.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  artifactDownloadUrl,
  buildToMarkdown,
  enabledOptions,
  formatBytes,
  optionLabel,
  plural,
  runSteps,
  zipFileName,
} from './summary.ts';
import { BUILD } from './test-fixtures.ts';

describe('summary helpers', () => {
  it('labels options', () => {
    assert.equal(optionLabel('with_slack'), 'Slack');
    assert.equal(optionLabel('with_acp'), 'ACP');
    assert.equal(optionLabel('persona'), 'Persona');
    assert.deepEqual(enabledOptions(BUILD), ['Eval', 'Persona']);
  });

  it('formats sizes and counts', () => {
    assert.equal(formatBytes(900), '900 B');
    assert.equal(formatBytes(58213), '56.8 KB');
    assert.equal(formatBytes(10 * 1024 * 1024), '10 MB');
    assert.equal(plural(1, 'file'), '1 file');
    assert.equal(plural(41, 'file'), '41 files');
  });

  it('gives run steps that hold for every project', () => {
    const steps = runSteps('research-summarizer.zip');
    assert.equal(steps.length, 3);
    assert.match(steps[0], /research-summarizer\.zip/);
    assert.ok(steps.some((s) => s.includes('.env.example')));
    assert.ok(steps.some((s) => s.includes('README.md')));
  });

  it('renders Markdown for the owner', () => {
    const md = buildToMarkdown(BUILD);
    for (const s of ['# research-summarizer', 'Package: `research_summarizer`', 'Options: Eval, Persona', 'Tools: web_search', '41 files, 56.8 KB']) {
      assert.ok(md.includes(s), `missing ${s}`);
    }
    assert.ok(md.includes('reasoning default'));
  });

  it('makes a safe zip name', () => {
    assert.equal(zipFileName('research-summarizer'), 'research-summarizer.zip');
    assert.equal(zipFileName('../../etc'), 'etc.zip');
    assert.equal(zipFileName('"; rm'), 'rm.zip');
    assert.equal(zipFileName('///'), 'agent.zip');
  });

  it('builds the single-artifact URL', () => {
    const url = new URL(artifactDownloadUrl('adk_agent_builder', 'session-1', BUILD), 'http://x');
    assert.equal(url.pathname, '/api/artifacts');
    assert.equal(url.searchParams.get('app_name'), 'adk_agent_builder');
    assert.equal(url.searchParams.get('session_id'), 'session-1');
    assert.equal(url.searchParams.get('artifact_name'), 'research-summarizer.zip');
    assert.equal(url.searchParams.get('version'), '0');
  });
});
```

`adk-web-ui/lib/build/data-url.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dataUrlToBytes } from './data-url.ts';

describe('dataUrlToBytes', () => {
  it('decodes a base64 data URL', () => {
    const out = dataUrlToBytes('data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==');
    assert.ok(out);
    assert.equal(out.mimeType, 'application/zip');
    assert.equal(out.bytes.length, 22);
    assert.deepEqual([...out.bytes.slice(0, 4)], [0x50, 0x4b, 5, 6]);
  });

  it('returns null for anything else', () => {
    assert.equal(dataUrlToBytes('https://x.test/a.zip'), null);
    assert.equal(dataUrlToBytes('data:text/plain,hello'), null);
    assert.equal(dataUrlToBytes('data:application/zip;base64,%%%'), null);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `adk-web-ui/`): `node --import tsx --test lib/build/parse.test.ts lib/build/summary.test.ts lib/build/data-url.test.ts`
Expected: FAIL with `Cannot find module` for `parse.ts`, `summary.ts`, `data-url.ts`.

- [ ] **Step 4: Implement**

`adk-web-ui/lib/build/parse.ts`:

```ts
import type { Build, BuildModels } from './types';

/** Same caps as package_agent, so the UI never trusts more than the backend writes. */
const LIMITS = { name: 100, description: 2000, model: 200, item: 64, items: 50, options: 30, artifact: 255, date: 40 };
const ARTIFACT_RE = /^[^/\\\u0000-\u001f\u007f]+\.zip$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v : null;
}

function count(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

function names(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .slice(0, LIMITS.items)
    .map((x) => x.slice(0, LIMITS.item));
}

function options(v: unknown): Record<string, boolean> {
  if (!isRecord(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(v).slice(0, LIMITS.options)) {
    if (typeof value === 'boolean' && key.length <= LIMITS.item) out[key] = value;
  }
  return out;
}

function models(v: unknown): BuildModels {
  const m = isRecord(v) ? v : {};
  return { fast: text(m.fast, LIMITS.model), reasoning: text(m.reasoning, LIMITS.model) };
}

/** Validated `state["builder:build"]`, or null. Used on stream data and stored messages. */
export function parseBuild(raw: unknown): Build | null {
  if (!isRecord(raw)) return null;
  const name = text(raw.name, LIMITS.name);
  const pkg = text(raw.package, LIMITS.name);
  const artifact = text(raw.artifact, LIMITS.artifact);
  const version = count(raw.version);
  if (!name || !pkg || !artifact || !ARTIFACT_RE.test(artifact) || artifact.includes('..') || version === null) {
    return null;
  }
  return {
    name,
    package: pkg,
    description: typeof raw.description === 'string' ? raw.description.slice(0, LIMITS.description) : '',
    options: options(raw.options),
    models: models(raw.models),
    tools: names(raw.tools),
    skills: names(raw.skills),
    artifact,
    version,
    files: count(raw.files) ?? 0,
    bytes: count(raw.bytes) ?? 0,
    packagedAt: text(raw.packagedAt, LIMITS.date) ?? '',
  };
}
```

`adk-web-ui/lib/build/summary.ts`:

```ts
import type { Build } from './types';

/** "with_slack" → "Slack", "persona" → "Persona". */
export function optionLabel(key: string): string {
  return key
    .replace(/^with_/, '')
    .split('_')
    .filter(Boolean)
    .map((w) => (w === 'acp' ? 'ACP' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Labels of the nuvel options the build was scaffolded with, sorted. */
export function enabledOptions(build: Pick<Build, 'options'>): string[] {
  return Object.entries(build.options)
    .filter(([, on]) => on)
    .map(([key]) => optionLabel(key))
    .sort();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Steps that hold for every generated project; its README has the details. */
export function runSteps(artifact: string): string[] {
  return [
    `Unzip ${artifact}.`,
    'Copy .env.example to .env and fill in the keys it lists.',
    'Follow README.md to run it locally and deploy it.',
  ];
}

/** Plain summary for the owner notification. */
export function buildToMarkdown(build: Build): string {
  const out = [`# ${build.name}`, ''];
  if (build.description) out.push(build.description, '');
  out.push(`- Package: \`${build.package}\``);
  const options = enabledOptions(build);
  if (options.length) out.push(`- Options: ${options.join(', ')}`);
  out.push(`- Models: fast ${build.models.fast ?? 'default'}, reasoning ${build.models.reasoning ?? 'default'}`);
  if (build.tools.length) out.push(`- Tools: ${build.tools.join(', ')}`);
  if (build.skills.length) out.push(`- Skills: ${build.skills.join(', ')}`);
  out.push(`- Zip: ${build.artifact}, ${plural(build.files, 'file')}, ${formatBytes(build.bytes)}`);
  return out.join('\n') + '\n';
}

/** Download name for a stored zip: the project name, never a path or a quote. */
export function zipFileName(projectName: string): string {
  const stem = projectName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${stem || 'agent'}.zip`;
}

/** The existing single-artifact route (`/api/artifacts?artifact_name=&version=`). */
export function artifactDownloadUrl(
  appName: string,
  sessionId: string,
  build: Pick<Build, 'artifact' | 'version'>,
): string {
  const params = new URLSearchParams({
    app_name: appName,
    session_id: sessionId,
    artifact_name: build.artifact,
    version: String(build.version),
  });
  return `/api/artifacts?${params.toString()}`;
}
```

`adk-web-ui/lib/build/data-url.ts`:

```ts
/** Bytes of a `data:<mime>;base64,<data>` URL (what /api/artifacts returns), or null. */
export function dataUrlToBytes(url: string): { mimeType: string; bytes: Uint8Array<ArrayBuffer> } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]*)$/.exec(url);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { mimeType: match[1], bytes };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test lib/build/parse.test.ts lib/build/summary.test.ts lib/build/data-url.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add adk-web-ui/lib/build
git commit -m "feat(builds): parse builder:build and add build display helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Build card in the chat; remove the blueprint UI and client code

**Files:**
- Modify: `adk-web-ui/lib/types.ts` (imports, `Message`, `StreamChunk`)
- Modify: `adk-web-ui/lib/adk-client.ts:11-13,471-477`
- Modify: `adk-web-ui/lib/chat/stream-assembler.ts`
- Modify: `adk-web-ui/lib/chat/payloads.ts`
- Modify: `adk-web-ui/lib/hooks/useStreamingChat.ts:201`
- Modify: `adk-web-ui/components/chat/renderers/index.tsx`
- Modify: `adk-web-ui/lib/drizzle/schema/blueprint-submissions.ts` (legacy note only)
- Create: `adk-web-ui/components/build/BuildCard.tsx`, `adk-web-ui/components/build/download.ts`
- Delete: `adk-web-ui/lib/blueprint/` (all files), `adk-web-ui/components/blueprint/` (all files), `adk-web-ui/app/api/blueprints/route.ts`, `adk-web-ui/e2e/blueprint.spec.ts`
- Test: `adk-web-ui/lib/adk-client.test.ts`, `adk-web-ui/lib/chat/stream-assembler.test.ts`, `adk-web-ui/lib/chat/payloads.test.ts`

**Interfaces:**
- Consumes (Task 1): `Build`, `BUILD_STATE_KEY`, `parseBuild`, `enabledOptions`, `formatBytes`, `plural`, `artifactDownloadUrl`, `dataUrlToBytes`, `BUILD` fixture.
- Produces:
  - `StreamChunk` variant `{ type: 'build'; build: Build; author?: string }`; `Message.build?: Build`; `AssembledMessage.build?: Build`.
  - `MessagePayload` variant `{ type: 'build'; build: Build }`; `messagePayloads({ ..., build?: unknown })` drops the artifact named `build.artifact`.
  - `components/build/BuildCard.tsx` default export `BuildCard({ build }: { build: Build })` (Task 6 extends it).
  - `components/build/download.ts`: `type DownloadResult = 'ok' | 'gone' | 'error'`, `downloadBuildZip(appName, sessionId, build): Promise<DownloadResult>`.

- [ ] **Step 1: Write the failing tests**

Append to `adk-web-ui/lib/adk-client.test.ts` (new `describe` at the end of the file):

```ts
describe('adk-client build state', () => {
  it('yields a parsed builder:build from the state delta', async () => {
    const build = {
      name: 'research-summarizer',
      package: 'research_summarizer',
      artifact: 'research-summarizer.zip',
      version: 0,
      files: 41,
      bytes: 58213,
    };
    const events = [
      { author: 'adk_agent_builder', actions: { stateDelta: { 'builder:build': build } } },
      { author: 'adk_agent_builder', actions: { state_delta: { 'builder:build': { name: 'bad' } } } },
    ];
    const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })) as typeof fetch;
    try {
      const chunks = [];
      for await (const chunk of adkClient.streamPreview('session-abc', 'p-1', 'Hello')) chunks.push(chunk);
      const builds = chunks.filter((c) => c.type === 'build');
      assert.equal(builds.length, 1);
      assert.equal(builds[0].type === 'build' ? builds[0].build.artifact : null, 'research-summarizer.zip');
    } finally {
      globalThis.fetch = original;
    }
  });
});
```

In `adk-web-ui/lib/chat/stream-assembler.test.ts`, add `import { BUILD } from '../build/test-fixtures.ts';` after the existing import, and replace the whole `it('keeps a streamed blueprint and falls back to the fence', ...)` block with:

```ts
  it('keeps the latest streamed build', () => {
    const a = new StreamAssembler({ name: 'adk_agent_builder' });
    a.apply({ type: 'text', content: 'Packaged.' });
    assert.deepEqual(a.apply({ type: 'build', build: BUILD }), {});
    assert.deepEqual(a.apply({ type: 'build', build: { ...BUILD, version: 1 } }), {});
    const msg = a.finalize();
    assert.equal(msg.build?.version, 1);
    assert.equal(msg.content, 'Packaged.');
  });

  it('leaves blueprint-looking fences as plain text', () => {
    const a = new StreamAssembler({ name: 'adk_agent_builder' });
    a.apply({ type: 'text', content: 'Design.\n```blueprintjson\n{}\n```' });
    const msg = a.finalize();
    assert.equal(msg.build, undefined);
    assert.ok(msg.content.includes('blueprintjson'));
  });
```

In `adk-web-ui/lib/chat/payloads.test.ts`, add `import { BUILD } from '../build/test-fixtures.ts';` after the existing import, and replace the `it('appends a valid blueprint after the text', ...)` block with:

```ts
  it('renders the build card and drops the duplicate zip artifact', () => {
    const zip = { id: 'research-summarizer.zip', name: 'research-summarizer.zip', type: 'file' as const, url: 'data:application/zip;base64,UEs=' };
    const p = messagePayloads({ content: 'Packaged.', artifacts: [zip, artifact], build: BUILD });
    assert.deepEqual(p.map((x) => x.type), ['text', 'build', 'artifact']);
    const listed = p.find((x) => x.type === 'artifact');
    assert.deepEqual(listed?.type === 'artifact' ? listed.artifacts.map((a) => a.name) : null, ['a.png']);
  });
  it('omits the artifact payload when the zip was the only artifact', () => {
    const zip = { id: 'z', name: 'research-summarizer.zip', type: 'file' as const, url: 'data:application/zip;base64,UEs=' };
    assert.deepEqual(messagePayloads({ content: 'Packaged.', artifacts: [zip], build: BUILD }).map((x) => x.type), ['text', 'build']);
  });
  it('ignores an invalid stored build and keeps the artifacts', () => {
    const zip = { id: 'z', name: 'research-summarizer.zip', type: 'file' as const, url: 'data:application/zip;base64,UEs=' };
    assert.deepEqual(messagePayloads({ content: 'Hi', artifacts: [zip], build: { name: 'bad' } }).map((x) => x.type), ['text', 'artifact']);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test lib/adk-client.test.ts lib/chat/stream-assembler.test.ts lib/chat/payloads.test.ts`
Expected: FAIL — no `build` chunk is yielded; `apply({type:'build'})` falls through the switch (returns `undefined`, not `{}`); payload types lack `'build'`.

- [ ] **Step 3: Swap the types**

In `adk-web-ui/lib/types.ts`:
- Replace `import type { Blueprint } from './blueprint/types';` with `import type { Build } from './build/types';`.
- In `interface Message`, replace `blueprint?: Blueprint;` with `build?: Build;`.
- In `StreamChunk`, replace `| { type: 'blueprint'; blueprint: Blueprint; author?: string }` with `| { type: 'build'; build: Build; author?: string }`.

- [ ] **Step 4: Read `builder:build` in the stream**

In `adk-web-ui/lib/adk-client.ts` replace `import { parseBlueprint } from './blueprint/parse';` with:

```ts
import { parseBuild } from './build/parse';
import { BUILD_STATE_KEY } from './build/types';
```

and replace the block

```ts
                // The builder's blueprint (agents/adk_agent_builder/callbacks/blueprint_document.py).
                const blueprintRaw = stateDelta?.['blueprint:document'];
                if (blueprintRaw) {
                  const blueprint = parseBlueprint(blueprintRaw);
                  if (blueprint) yield { type: 'blueprint', blueprint, author: eventData.author };
                }
```

with

```ts
                // The builder packaged a project (package_agent writes state["builder:build"]).
                const buildRaw = stateDelta?.[BUILD_STATE_KEY];
                if (buildRaw) {
                  const build = parseBuild(buildRaw);
                  if (build) yield { type: 'build', build, author: eventData.author };
                }
```

- [ ] **Step 5: Update the assembler**

In `adk-web-ui/lib/chat/stream-assembler.ts`:
- Replace the two blueprint imports (`import type { Blueprint } ...` and `import { resolveBlueprintContent } ...`) with `import type { Build } from '../build/types';`.
- In `AssembledMessage`, replace `blueprint?: Blueprint;` with `build?: Build;`.
- Replace the field `private blueprint: Blueprint | undefined;` with `private build: Build | undefined;`.
- Replace the switch case

```ts
      case 'blueprint':
        if (chunk.blueprint) this.blueprint = chunk.blueprint;
        return {};
```

with

```ts
      case 'build':
        // Each repackage overwrites the state key; the latest one wins.
        if (chunk.build) this.build = chunk.build;
        return {};
```

- Replace the whole `finalize` method (doc comment included) with:

```ts
  /**
   * The assistant message for this turn. Closes running steps and resolves
   * the guide document (state_delta first, fenced-JSON fallback) so the
   * stored `content` is the lead text rather than raw JSON.
   */
  finalize({ includeExtras = true }: { includeExtras?: boolean } = {}): AssembledMessage {
    this.steps.closeRunning();
    const resolved = resolveGuideMessageContent(this.content, this.guideDocument);
    return {
      content: resolved.content,
      build: this.build,
      thinking: this.thinking || undefined,
      subAgentSteps: includeExtras && this.steps.length > 0 ? this.steps.snapshot() : undefined,
      mapsCaptures: includeExtras && this.mapsCaptures.length > 0 ? [...this.mapsCaptures] : undefined,
      guideDocument: resolved.guideDocument,
    };
  }
```

- In the class doc comment, replace "collects maps/guide payloads" with "collects maps/guide/build payloads".

- [ ] **Step 6: Update the payloads**

In `adk-web-ui/lib/chat/payloads.ts`:
- Replace the two blueprint imports with:

```ts
import type { Build } from '../build/types';
import { parseBuild } from '../build/parse';
```

- In the `MessagePayload` doc comment replace "(e.g. a builder blueprint)" with "(e.g. the builder's build card)", and replace `| { type: 'blueprint'; blueprint: Blueprint };` with `| { type: 'build'; build: Build };`.
- Replace the whole `messagePayloads` function with:

```ts
/**
 * Split a message into renderable payloads. A valid guide document replaces
 * the text/artifact/maps rendering; it is re-validated because stored or
 * rehydrated messages may carry a stale shape. A valid build adds its card
 * and takes its zip out of the generic artifact list (the card downloads it).
 */
export function messagePayloads(message: {
  content: unknown;
  artifacts?: Artifact[];
  mapsCaptures?: MapsCapture[];
  guideDocument?: unknown;
  build?: unknown;
}): MessagePayload[] {
  const guide = message.guideDocument ? parseGuideDocument(message.guideDocument) : null;
  if (guide) return [{ type: 'guide', document: mergeGuideWithCaptures(guide, message.mapsCaptures ?? []) }];

  const payloads: MessagePayload[] = [];
  const text = getDisplayContent(message.content);
  if (text) payloads.push({ type: 'text', text });
  const build = message.build ? parseBuild(message.build) : null;
  if (build) payloads.push({ type: 'build', build });
  const artifacts = (message.artifacts ?? []).filter((a) => !build || a.name !== build.artifact);
  if (artifacts.length) payloads.push({ type: 'artifact', artifacts });
  if (message.mapsCaptures?.length) payloads.push({ type: 'maps', captures: message.mapsCaptures });
  return payloads;
}
```

In `adk-web-ui/lib/hooks/useStreamingChat.ts` replace `blueprint: m.blueprint,` with `build: m.build,`.

- [ ] **Step 7: Run the unit tests to verify they pass**

Run: `node --import tsx --test lib/adk-client.test.ts lib/chat/stream-assembler.test.ts lib/chat/payloads.test.ts`
Expected: PASS.

- [ ] **Step 8: Add the download helper and the card**

`adk-web-ui/components/build/download.ts`:

```ts
import { dataUrlToBytes } from '@/lib/build/data-url';
import { artifactDownloadUrl } from '@/lib/build/summary';
import type { Build } from '@/lib/build/types';

export type DownloadResult = 'ok' | 'gone' | 'error';

/**
 * Fetch the zip through the existing single-artifact route and save it.
 * A 404 means the backend restarted and its in-memory artifact is gone.
 */
export async function downloadBuildZip(
  appName: string,
  sessionId: string,
  build: Pick<Build, 'artifact' | 'version'>,
): Promise<DownloadResult> {
  try {
    const res = await fetch(artifactDownloadUrl(appName, sessionId, build));
    if (res.status === 404) return 'gone';
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Array<{ url?: unknown }> } | null;
    const url = res.ok && json?.success ? json.data?.[0]?.url : undefined;
    const decoded = typeof url === 'string' ? dataUrlToBytes(url) : null;
    if (!decoded) return 'error';
    const href = URL.createObjectURL(new Blob([decoded.bytes], { type: decoded.mimeType }));
    const link = document.createElement('a');
    link.href = href;
    link.download = build.artifact;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
    return 'ok';
  } catch {
    return 'error';
  }
}
```

`adk-web-ui/components/build/BuildCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Download, Package } from 'lucide-react';
import type { Build } from '@/lib/build/types';
import { enabledOptions, formatBytes, plural } from '@/lib/build/summary';
import { BUILDER_AGENT } from '@/lib/builder';
import { toSessionId } from '@/lib/ids';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { downloadBuildZip, type DownloadResult } from './download';

const DOWNLOAD_PROBLEMS: Record<Exclude<DownloadResult, 'ok'>, string> = {
  gone: 'This zip is no longer on the server (the builder restarted). Ask the builder to package it again.',
  error: 'The download failed. Try again in a moment.',
};

/** The packaged project, inline in the chat, with its download. */
export default function BuildCard({ build }: { build: Build }) {
  const conversationId = useAppStore((s) => s.currentConversation?.id);
  const [downloading, setDownloading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  let sessionId: string | undefined;
  try {
    sessionId = conversationId ? toSessionId(conversationId) : undefined;
  } catch {
    sessionId = undefined;
  }

  const options = enabledOptions(build);
  const models = [build.models.fast, build.models.reasoning].filter((m): m is string => Boolean(m));

  const download = async () => {
    if (!sessionId || downloading) return;
    setDownloading(true);
    setProblem(null);
    const result = await downloadBuildZip(BUILDER_AGENT, sessionId, build);
    setDownloading(false);
    if (result !== 'ok') setProblem(DOWNLOAD_PROBLEMS[result]);
  };

  return (
    <Card variant="filled" className="p-5" role="group" aria-label={`Build: ${build.name}`}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--md-shape-md)] bg-md-primary-container text-md-on-primary-container">
          <Package className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-label-medium uppercase tracking-wider text-md-on-surface-variant">Your agent</p>
          <h3 className="text-title-medium text-md-on-surface">{build.name}</h3>
          {build.description ? (
            <p className="mt-1 line-clamp-3 text-body-medium text-md-on-surface-variant">{build.description}</p>
          ) : null}
          {options.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {options.map((o) => (
                <Chip key={o} variant="category">
                  {o}
                </Chip>
              ))}
            </div>
          ) : null}
          {models.length > 0 ? (
            <p className="mt-3 break-all text-label-medium text-md-on-surface-variant">Models: {models.join(' · ')}</p>
          ) : null}
          <p className="mt-1 text-label-medium text-md-on-surface-variant">
            {plural(build.files, 'file')} · {plural(build.tools.length, 'tool')} · {plural(build.skills.length, 'skill')} ·{' '}
            {formatBytes(build.bytes)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col items-start gap-2">
        <Button size="sm" variant="tonal" onClick={download} disabled={!sessionId || downloading}>
          <Download /> {downloading ? 'Downloading…' : 'Download zip'}
        </Button>
        {problem ? (
          <p role="alert" className="text-body-medium text-md-error">
            {problem}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
```

- [ ] **Step 9: Register the renderer**

In `adk-web-ui/components/chat/renderers/index.tsx`:
- Replace `import BlueprintCard from '../../blueprint/BlueprintCard';` with `import BuildCard from '../../build/BuildCard';`.
- Replace the `BlueprintRenderer` function with:

```tsx
function BuildRenderer({ payload }: RendererProps<'build'>) {
  return <BuildCard build={payload.build} />;
}
```

- In `PAYLOAD_RENDERERS`, replace `blueprint: BlueprintRenderer,` with `build: BuildRenderer,`.

- [ ] **Step 10: Remove the blueprint code**

```bash
git rm -r adk-web-ui/lib/blueprint adk-web-ui/components/blueprint adk-web-ui/app/api/blueprints adk-web-ui/e2e/blueprint.spec.ts
```

In `adk-web-ui/lib/drizzle/schema/blueprint-submissions.ts` replace the doc comment above `export const blueprintSubmissions` with:

```ts
/**
 * LEGACY: blueprints visitors saved before builds replaced them. Nothing
 * writes or reads this table any more; the schema stays so drizzle-kit
 * doesn't generate a DROP and existing rows are kept. Personal data: see
 * /privacy.
 */
```

Then confirm nothing else imports the removed modules:

Run: `grep -rn "blueprint/\|parseBlueprint\|BlueprintCard\|type: 'blueprint'" adk-web-ui/app adk-web-ui/components adk-web-ui/lib --include='*.ts' --include='*.tsx'`
Expected: no output. (The analytics still say "blueprint" in labels and SQL until Task 8; that is expected here.)

- [ ] **Step 11: Verify**

Run (from `adk-web-ui/`): `npm run test:unit && npx tsc --noEmit && npm run lint`
Expected: all unit tests PASS (the old blueprint tests are gone with their files); typecheck and lint clean.

- [ ] **Step 12: Commit**

```bash
git add -A adk-web-ui/lib adk-web-ui/components adk-web-ui/app adk-web-ui/e2e
git commit -m "feat(chat): build card with zip download replaces the blueprint

The stream now reads state[\"builder:build\"]; the card downloads the zip
through /api/artifacts and the duplicate generic artifact is dropped.
Blueprint parsing, card, dialog, API route and e2e are removed; the
blueprint_submissions schema stays as legacy.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `build_saves` table, `bytea` type and the `gone` API error

**Files:**
- Create: `adk-web-ui/lib/drizzle/bytea.ts`, test `adk-web-ui/lib/drizzle/bytea.test.ts`
- Create: `adk-web-ui/lib/drizzle/schema/build-saves.ts`
- Modify: `adk-web-ui/lib/drizzle/schema/index.ts`
- Create: `adk-web-ui/drizzle/migrations/0015_build_saves.sql`
- Modify: `adk-web-ui/drizzle/migrations/meta/_journal.json`
- Create: `adk-web-ui/lib/build/db-store.ts`
- Modify: `adk-web-ui/lib/api-error.ts`, test `adk-web-ui/lib/api-error.test.ts`

**Interfaces:**
- Consumes (Task 1): `Build`, `NewBuildSave`.
- Produces:
  - `byteaToBuffer(value: unknown): Buffer`, `bytea` (Drizzle custom column).
  - `buildSaves` table (Drizzle), migration `0015_build_saves`.
  - `ApiErrorCode` gains `'gone'` (HTTP 410).
  - `lib/build/db-store.ts`: `insertBuildSave(r: NewBuildSave): Promise<{ id: string }>`, `markEmailSent(id): Promise<void>`, `markNotified(id): Promise<void>`, `findBuildSave(tokenHash): Promise<BuildSaveView | null>` with `BuildSaveView = { projectName: string; build: unknown; zipBytes: number; createdAt: Date; deletedAt: Date | null }`, `takeBuildZip(tokenHash): Promise<{ zip: Buffer; projectName: string } | null>`, `wipeBuildSave(tokenHash): Promise<boolean>`, `buildSaveStore = { insert, markEmailSent, markNotified }`, `buildLinkStore = { takeZip, wipe }`.

- [ ] **Step 1: Write the failing tests**

`adk-web-ui/lib/drizzle/bytea.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { byteaToBuffer } from './bytea.ts';

describe('byteaToBuffer', () => {
  it('accepts what Postgres drivers return for bytea', () => {
    const expected = Buffer.from([0x50, 0x4b, 5, 6]);
    assert.deepEqual(byteaToBuffer(expected), expected);
    assert.deepEqual(byteaToBuffer(new Uint8Array([0x50, 0x4b, 5, 6])), expected);
    assert.deepEqual(byteaToBuffer('\\x504b0506'), expected);
  });

  it('rejects anything else', () => {
    assert.throws(() => byteaToBuffer('504b'), TypeError);
    assert.throws(() => byteaToBuffer(12), TypeError);
  });
});
```

Append to `adk-web-ui/lib/api-error.test.ts`:

```ts
describe('gone', () => {
  it('is a 410 code with friendly copy', () => {
    assert.equal(isApiErrorCode('gone'), true);
    assert.equal(API_ERROR_STATUS.gone, 410);
    assert.match(friendlyMessage('gone'), /no longer available/);
  });
});
```

and add `API_ERROR_STATUS,` to that file's import list from `./api-error.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test lib/drizzle/bytea.test.ts lib/api-error.test.ts`
Expected: FAIL — `bytea.ts` not found; `isApiErrorCode('gone')` is false.

- [ ] **Step 3: Implement `bytea` and the error code**

`adk-web-ui/lib/drizzle/bytea.ts`:

```ts
import { customType } from 'drizzle-orm/pg-core';

/**
 * Postgres `bytea` as a Buffer. Drivers differ in what they hand back: a
 * Buffer, a Uint8Array, or the text form `\x<hex>`; normalize all three.
 * (neon-http sends Buffer parameters as `\x<hex>` itself.)
 */
export function byteaToBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string' && value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
  throw new TypeError('unexpected bytea value');
}

export const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array | string }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer) {
    return value;
  },
  fromDriver(value: Buffer | Uint8Array | string) {
    return byteaToBuffer(value);
  },
});
```

In `adk-web-ui/lib/api-error.ts`:
- Add `| 'gone'` to `ApiErrorCode` (after `'not_found'`).
- Add `gone: 410,` to `API_ERROR_STATUS` (after `not_found: 404,`).
- Add `gone: 'That is no longer available.',` to `FRIENDLY_MESSAGES` (after `not_found`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test lib/drizzle/bytea.test.ts lib/api-error.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the schema, migration and journal entry**

`adk-web-ui/lib/drizzle/schema/build-saves.ts`:

```ts
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core';
import { bytea } from '../bytea';

/**
 * Builds a visitor emailed to themselves: the zip, the build summary and the
 * email, behind a link whose token is only stored hashed. "Delete this build"
 * nulls `email` and `zip` and sets `deleted_at`. Analytics reads the
 * metadata columns only, never `zip`. Personal data: see /privacy.
 */
export const buildSaves = pgTable(
  'build_saves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    email: text('email'),
    userId: text('user_id'),
    sessionId: text('session_id').notNull(),
    projectName: text('project_name').notNull(),
    build: jsonb('build').notNull(),
    zip: bytea('zip'),
    zipBytes: integer('zip_bytes').notNull(),
    updatesConsentAt: timestamp('updates_consent_at', { withTimezone: true }),
    helpRequested: boolean('help_requested').default(false).notNull(),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    notified: boolean('notified').default(false).notNull(),
    downloads: integer('downloads').default(0).notNull(),
    lastDownloadedAt: timestamp('last_downloaded_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    createdAtIdx: index('idx_build_saves_created_at').on(table.createdAt),
    sessionIdIdx: index('idx_build_saves_session_id').on(table.sessionId),
  })
);

export type BuildSave = typeof buildSaves.$inferSelect;
```

In `adk-web-ui/lib/drizzle/schema/index.ts` add after `export * from './blueprint-submissions';`:

```ts
export * from './build-saves';
```

`adk-web-ui/drizzle/migrations/0015_build_saves.sql`:

```sql
CREATE TABLE IF NOT EXISTS "build_saves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_hash" text NOT NULL,
	"email" text,
	"user_id" text,
	"session_id" text NOT NULL,
	"project_name" text NOT NULL,
	"build" jsonb NOT NULL,
	"zip" bytea,
	"zip_bytes" integer NOT NULL,
	"updates_consent_at" timestamp with time zone,
	"help_requested" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp with time zone,
	"notified" boolean DEFAULT false NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"last_downloaded_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "build_saves_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_build_saves_created_at" ON "build_saves" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_build_saves_session_id" ON "build_saves" USING btree ("session_id");
```

In `adk-web-ui/drizzle/migrations/meta/_journal.json`, append after the `0014_blueprint_submissions` entry (add a comma after its closing brace):

```json
    {
      "idx": 7,
      "version": "7",
      "when": 1791100000000,
      "tag": "0015_build_saves",
      "breakpoints": true
    }
```

- [ ] **Step 6: Add the store**

`adk-web-ui/lib/build/db-store.ts`:

```ts
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/drizzle/db';
import { buildSaves } from '@/lib/drizzle/schema/build-saves';
import type { NewBuildSave } from './types';

let ensured: Promise<void> | null = null;

/** Idempotent bootstrap, once per process (same table as migration 0015). */
function ensureSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "build_saves" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "token_hash" text NOT NULL,
          "email" text,
          "user_id" text,
          "session_id" text NOT NULL,
          "project_name" text NOT NULL,
          "build" jsonb NOT NULL,
          "zip" bytea,
          "zip_bytes" integer NOT NULL,
          "updates_consent_at" timestamp with time zone,
          "help_requested" boolean DEFAULT false NOT NULL,
          "email_sent_at" timestamp with time zone,
          "notified" boolean DEFAULT false NOT NULL,
          "downloads" integer DEFAULT 0 NOT NULL,
          "last_downloaded_at" timestamp with time zone,
          "deleted_at" timestamp with time zone,
          CONSTRAINT "build_saves_token_hash_unique" UNIQUE("token_hash")
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_build_saves_created_at" ON "build_saves" USING btree ("created_at")
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_build_saves_session_id" ON "build_saves" USING btree ("session_id")
      `);
    })().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}

export async function insertBuildSave(record: NewBuildSave): Promise<{ id: string }> {
  await ensureSchema();
  const [row] = await db
    .insert(buildSaves)
    .values({
      tokenHash: record.tokenHash,
      email: record.email,
      userId: record.userId,
      sessionId: record.sessionId,
      projectName: record.build.name,
      build: record.build,
      zip: record.zip,
      zipBytes: record.zip.length,
      updatesConsentAt: record.updatesConsentAt,
      helpRequested: record.helpRequested,
    })
    .returning({ id: buildSaves.id });
  return { id: row.id };
}

export async function markEmailSent(id: string): Promise<void> {
  await ensureSchema();
  await db.update(buildSaves).set({ emailSentAt: new Date() }).where(eq(buildSaves.id, id));
}

export async function markNotified(id: string): Promise<void> {
  await ensureSchema();
  await db.update(buildSaves).set({ notified: true }).where(eq(buildSaves.id, id));
}

export type BuildSaveView = {
  projectName: string;
  build: unknown;
  zipBytes: number;
  createdAt: Date;
  deletedAt: Date | null;
};

/** Metadata for the link page: never the zip, never the email. */
export async function findBuildSave(tokenHash: string): Promise<BuildSaveView | null> {
  await ensureSchema();
  const [row] = await db
    .select({
      projectName: buildSaves.projectName,
      build: buildSaves.build,
      zipBytes: buildSaves.zipBytes,
      createdAt: buildSaves.createdAt,
      deletedAt: buildSaves.deletedAt,
    })
    .from(buildSaves)
    .where(eq(buildSaves.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

/** The stored zip, counting the download; null when unknown or deleted. */
export async function takeBuildZip(tokenHash: string): Promise<{ zip: Buffer; projectName: string } | null> {
  await ensureSchema();
  const [row] = await db
    .update(buildSaves)
    .set({ downloads: sql`${buildSaves.downloads} + 1`, lastDownloadedAt: new Date() })
    .where(and(eq(buildSaves.tokenHash, tokenHash), isNull(buildSaves.deletedAt), isNotNull(buildSaves.zip)))
    .returning({ zip: buildSaves.zip, projectName: buildSaves.projectName });
  return row?.zip ? { zip: row.zip, projectName: row.projectName } : null;
}

/** "Delete this build": drop the zip and the email, keep the anonymous metadata. */
export async function wipeBuildSave(tokenHash: string): Promise<boolean> {
  await ensureSchema();
  const rows = await db
    .update(buildSaves)
    .set({ zip: null, email: null, deletedAt: new Date() })
    .where(and(eq(buildSaves.tokenHash, tokenHash), isNull(buildSaves.deletedAt)))
    .returning({ id: buildSaves.id });
  return rows.length > 0;
}

export const buildSaveStore = { insert: insertBuildSave, markEmailSent, markNotified };
export const buildLinkStore = { takeZip: takeBuildZip, wipe: wipeBuildSave };
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run test:unit`
Expected: clean; all PASS.

Optional local-DB check (Docker): `npm run db:dev:up && npm run db:migrate` — Expected: migration `0015_build_saves` applies; `psql` `\d build_saves` shows the columns above.

- [ ] **Step 8: Commit**

```bash
git add adk-web-ui/lib/drizzle adk-web-ui/drizzle adk-web-ui/lib/build/db-store.ts adk-web-ui/lib/api-error.ts adk-web-ui/lib/api-error.test.ts
git commit -m "feat(builds): build_saves table, bytea column and 410 gone error

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Config, token, request validation, email body, Resend sender, owner webhook, zip decoding

**Files:**
- Create: `adk-web-ui/lib/build/config.ts`, `token.ts`, `request.ts`, `email.ts`, `sender.ts`, `resend-client.ts`, `notify.ts`, `zip-part.ts`, `adk-build.ts`
- Test: `adk-web-ui/lib/build/config.test.ts`, `token.test.ts`, `request.test.ts`, `email.test.ts`, `sender.test.ts`, `notify.test.ts`, `zip-part.test.ts`
- Modify: `adk-web-ui/package.json`, `adk-web-ui/package-lock.json` (add `resend`)

**Interfaces:**
- Consumes: Task 1 (`Build`, `SessionBuildLookup`, `ZipLookup`, `parseBuild`, `BUILD_STATE_KEY`, `enabledOptions`, `plural`, `runSteps`, `buildToMarkdown`); `lib/identity.ts` `Identity`; `lib/limits/limiter.ts` `Bucket`; `lib/artifact-base64.ts` `toStandardBase64`; `lib/adk-config.ts` `adkFetch`; `lib/adk-url.ts` `adkPath`, `assertArtifactName`; `lib/builder.ts` `BUILDER_AGENT`.
- Produces:
  - `config.ts`: `DEFAULT_MAX_ZIP_BYTES`, `type BuildConfig`, `buildConfig(env?)`, `safeBookingUrl(v)`, `buildLink(base, token)`.
  - `token.ts`: `type BuildToken = { token: string; hash: string }`, `newBuildToken(bytes?)`, `hashBuildToken(token)`, `isBuildToken(v)`.
  - `request.ts`: `type BuildSaveRequest`, `type BuildSaveLimits`, `validateBuildRequest(body)`, `buildSaveBuckets(identity, limits)`.
  - `email.ts`: `type BuildLinkMessage = { subject; html; text }`, `buildLinkEmail(build, link)`.
  - `sender.ts`: `type ResendResult<T>`, `type EmailClient`, `type EmailSender = { client: EmailClient; from: string; replyTo: string | null }`, `type SendOutcome`, `type SendLinkArgs = { saveId: string; to: string; link: string; message: BuildLinkMessage }`, `idempotencyKey(saveId)`, `sendBuildLink(sender | null, args, log?)`, `addUpdatesContact(client | null, email, segmentId | null, log?)`.
  - `resend-client.ts`: `resendEmailClient(apiKey): EmailClient`.
  - `notify.ts`: `type OwnerNotification = { id; email; signedIn; build; updates; help }`, `notifyOwner(n, env, fetchImpl?): Promise<boolean>`.
  - `zip-part.ts`: `partBytes(part): Buffer | null`.
  - `adk-build.ts`: `loadSessionBuild(adkUserId, sessionId): Promise<SessionBuildLookup>`, `fetchBuildZip(adkUserId, sessionId, build): Promise<ZipLookup>`.

- [ ] **Step 1: Add the dependency**

Run (from `adk-web-ui/`): `npm install resend@^6.9.2`
Expected: `package.json` gains `"resend": "^6.x"` (>= 6.9.2) under `dependencies`; lockfile updated.

- [ ] **Step 2: Write the failing tests**

`adk-web-ui/lib/build/config.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAX_ZIP_BYTES, buildConfig, buildLink, safeBookingUrl } from './config.ts';

describe('buildConfig', () => {
  it('defaults to dev mode with no deployment values', () => {
    const c = buildConfig({});
    assert.equal(c.email, null);
    assert.equal(c.segmentId, null);
    assert.equal(c.bookingUrl, null);
    assert.equal(c.baseUrl, null);
    assert.equal(c.maxZipBytes, DEFAULT_MAX_ZIP_BYTES);
    assert.equal(DEFAULT_MAX_ZIP_BYTES, 10 * 1024 * 1024);
    assert.deepEqual(c.limits, { user: 10, anon: 3, anonIp: 10 });
    assert.deepEqual(c.webhook, { url: undefined, secret: undefined });
  });

  it('needs both the key and the sender to send email', () => {
    assert.equal(buildConfig({ RESEND_API_KEY: 're_x' }).email, null);
    assert.equal(buildConfig({ BUILD_EMAIL_FROM: 'A <a@b.test>' }).email, null);
    assert.deepEqual(buildConfig({ RESEND_API_KEY: 're_x', BUILD_EMAIL_FROM: 'A <a@b.test>', BUILD_EMAIL_REPLY_TO: 'r@b.test' }).email, {
      apiKey: 're_x',
      from: 'A <a@b.test>',
      replyTo: 'r@b.test',
    });
  });

  it('prefers BUILD_* and falls back to BLUEPRINT_*', () => {
    const legacy = buildConfig({
      BLUEPRINT_WEBHOOK_URL: 'https://hook.test/old',
      BLUEPRINT_WEBHOOK_SECRET: 'old',
      BLUEPRINT_BOOKING_URL: 'https://book.test/old',
      BLUEPRINT_SAVE_USER_DAILY: '7',
    });
    assert.deepEqual(legacy.webhook, { url: 'https://hook.test/old', secret: 'old' });
    assert.equal(legacy.bookingUrl, 'https://book.test/old');
    assert.equal(legacy.limits.user, 7);

    const current = buildConfig({
      BUILD_WEBHOOK_URL: 'https://hook.test/new',
      BLUEPRINT_WEBHOOK_URL: 'https://hook.test/old',
      BLUEPRINT_WEBHOOK_SECRET: 'old',
      BUILD_SAVE_ANON_DAILY: '5',
      BUILD_MAX_ZIP_BYTES: '2048',
      RESEND_SEGMENT_ID: 'seg_1',
    });
    // The secret pairs with the URL it belongs to.
    assert.deepEqual(current.webhook, { url: 'https://hook.test/new', secret: undefined });
    assert.equal(current.limits.anon, 5);
    assert.equal(current.maxZipBytes, 2048);
    assert.equal(current.segmentId, 'seg_1');
  });

  it('ignores invalid numbers and unsafe URLs', () => {
    const c = buildConfig({ BUILD_MAX_ZIP_BYTES: 'lots', BUILD_SAVE_USER_DAILY: '-1', BUILD_BOOKING_URL: 'http://book.test', NEXT_PUBLIC_BASE_URL: 'javascript:alert(1)' });
    assert.equal(c.maxZipBytes, DEFAULT_MAX_ZIP_BYTES);
    assert.equal(c.limits.user, 10);
    assert.equal(c.bookingUrl, null);
    assert.equal(c.baseUrl, null);
  });

  it('builds links from the configured base URL', () => {
    assert.equal(buildConfig({ NEXT_PUBLIC_BASE_URL: 'https://site.test/' }).baseUrl, 'https://site.test');
    assert.equal(buildLink('https://site.test', 'abc'), 'https://site.test/builds/abc');
    assert.equal(safeBookingUrl('https://book.test/me'), 'https://book.test/me');
    assert.equal(safeBookingUrl(undefined), null);
  });
});
```

`adk-web-ui/lib/build/token.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashBuildToken, isBuildToken, newBuildToken } from './token.ts';

describe('build tokens', () => {
  it('are 32 random bytes in base64url, stored only as sha256', () => {
    const t = newBuildToken();
    assert.equal(t.token.length, 43);
    assert.ok(isBuildToken(t.token));
    assert.match(t.hash, /^[0-9a-f]{64}$/);
    assert.equal(t.hash, hashBuildToken(t.token));
    assert.notEqual(newBuildToken().token, t.token);
  });

  it('uses the given byte source', () => {
    const t = newBuildToken(() => Buffer.alloc(32, 0xff));
    assert.equal(t.token, '_'.repeat(42) + '8');
    assert.equal(t.hash, hashBuildToken(t.token));
  });

  it('rejects malformed tokens', () => {
    assert.equal(isBuildToken('short'), false);
    assert.equal(isBuildToken('a'.repeat(42) + '/'), false);
    assert.equal(isBuildToken(undefined), false);
  });
});
```

`adk-web-ui/lib/build/request.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSaveBuckets, validateBuildRequest } from './request.ts';

const body = { email: ' Me@Example.com ', sessionId: 'session-123', updates: true, help: false };

describe('validateBuildRequest', () => {
  it('normalizes a valid body', () => {
    assert.deepEqual(validateBuildRequest(body), {
      ok: true,
      value: { email: 'me@example.com', sessionId: 'session-123', updates: true, help: false },
    });
  });

  it('treats anything but true as an unticked box', () => {
    const r = validateBuildRequest({ ...body, updates: 'yes', help: 1 });
    assert.ok(r.ok);
    assert.deepEqual([r.value.updates, r.value.help], [false, false]);
  });

  it('rejects bad input with a log-safe reason', () => {
    assert.deepEqual(validateBuildRequest(null), { ok: false, reason: 'body' });
    assert.deepEqual(validateBuildRequest([]), { ok: false, reason: 'body' });
    assert.deepEqual(validateBuildRequest({ ...body, email: 'nope' }), { ok: false, reason: 'email' });
    assert.deepEqual(validateBuildRequest({ ...body, email: `${'a'.repeat(250)}@x.io` }), { ok: false, reason: 'email' });
    assert.deepEqual(validateBuildRequest({ ...body, sessionId: undefined }), { ok: false, reason: 'session' });
    assert.deepEqual(validateBuildRequest({ ...body, sessionId: '../x' }), { ok: false, reason: 'session' });
    assert.deepEqual(validateBuildRequest({ ...body, sessionId: 'a.b' }), { ok: false, reason: 'session' });
  });
});

describe('buildSaveBuckets', () => {
  const limits = { user: 10, anon: 3, anonIp: 10 };
  it('limits users and anonymous visitors separately under bd: keys', () => {
    assert.deepEqual(buildSaveBuckets({ kind: 'user', userId: 'u1' }, limits), [{ key: 'bd:u:u1', limit: 10 }]);
    assert.deepEqual(buildSaveBuckets({ kind: 'anon', anonToken: 'tok', ipHash: 'ip' }, limits), [
      { key: 'bd:a:tok', limit: 3 },
      { key: 'bd:ip:ip', limit: 10 },
    ]);
    assert.deepEqual(buildSaveBuckets({ kind: 'anon', anonToken: 'tok', ipHash: null }, limits), [{ key: 'bd:a:tok', limit: 3 }]);
  });
});
```

`adk-web-ui/lib/build/email.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLinkEmail } from './email.ts';
import { BUILD } from './test-fixtures.ts';

const LINK = 'https://site.test/builds/' + 'a'.repeat(43);
const URL_RE = /https?:\/\/[^\s"'<>]+/g;

describe('buildLinkEmail', () => {
  const msg = buildLinkEmail(BUILD, LINK);

  it('names the agent and links to it', () => {
    assert.equal(msg.subject, 'Your agent: research-summarizer');
    assert.ok(msg.text.includes(LINK));
    assert.ok(msg.html.includes(`href="${LINK}"`));
    assert.ok(msg.text.includes('site.test'));
    assert.ok(msg.text.includes('.env.example'));
    assert.ok(msg.text.includes('41 files'));
  });

  it('contains no URL or domain that did not come from the link', () => {
    for (const body of [msg.text, msg.html]) {
      for (const url of body.match(URL_RE) ?? []) assert.equal(url, LINK);
    }
    const other = buildLinkEmail(BUILD, 'http://localhost:3000/builds/x');
    assert.ok(!other.text.includes('site.test'));
    assert.ok(other.text.includes('localhost:3000'));
  });

  it('escapes HTML from the build summary', () => {
    const evil = buildLinkEmail({ ...BUILD, name: '<b>x</b>', description: '<script>alert(1)</script>' }, LINK);
    assert.ok(!evil.html.includes('<script>'));
    assert.ok(evil.html.includes('&lt;script&gt;'));
    assert.ok(evil.html.includes('&lt;b&gt;x&lt;/b&gt;'));
  });
});
```

`adk-web-ui/lib/build/sender.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addUpdatesContact, idempotencyKey, sendBuildLink, type EmailClient } from './sender.ts';

const quiet = { info() {}, warn() {}, error() {} };
const args = {
  saveId: 'save-1',
  to: 'delivered@resend.dev',
  link: 'https://site.test/builds/tok',
  message: { subject: 'Your agent: x', html: '<p>x</p>', text: 'x' },
};

function client(over: Partial<EmailClient> = {}) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const c: EmailClient = {
    async sendEmail(...a) {
      calls.push({ method: 'sendEmail', args: a });
      return { data: { id: 'em_1' }, error: null };
    },
    async createContact(...a) {
      calls.push({ method: 'createContact', args: a });
      return { data: { id: 'c_1' }, error: null };
    },
    async addContactToSegment(...a) {
      calls.push({ method: 'addContactToSegment', args: a });
      return { data: { id: 'c_1' }, error: null };
    },
    ...over,
  };
  return { c, calls };
}

describe('sendBuildLink', () => {
  it('sends with the build-link/<save id> idempotency key', async () => {
    const { c, calls } = client();
    const out = await sendBuildLink({ client: c, from: 'Builds <b@site.test>', replyTo: 'r@site.test' }, args, quiet);
    assert.deepEqual(out, { kind: 'sent', emailId: 'em_1' });
    assert.equal(idempotencyKey('save-1'), 'build-link/save-1');
    const [payload, key] = calls[0].args as [Record<string, unknown>, string];
    assert.equal(key, 'build-link/save-1');
    assert.deepEqual(payload, {
      from: 'Builds <b@site.test>',
      to: ['delivered@resend.dev'],
      subject: 'Your agent: x',
      html: '<p>x</p>',
      text: 'x',
      replyTo: 'r@site.test',
    });
  });

  it('treats a returned {error} as a failure (the SDK does not throw)', async () => {
    const { c } = client({ sendEmail: async () => ({ data: null, error: { message: 'domain not verified', name: 'validation_error' } }) });
    assert.deepEqual(await sendBuildLink({ client: c, from: 'b@site.test', replyTo: null }, args, quiet), {
      kind: 'failed',
      reason: 'validation_error',
    });
  });

  it('also survives a thrown network error', async () => {
    const { c } = client({ sendEmail: async () => { throw new TypeError('fetch failed'); } });
    assert.deepEqual(await sendBuildLink({ client: c, from: 'b@site.test', replyTo: null }, args, quiet), { kind: 'failed', reason: 'exception' });
  });

  it('logs the link instead of sending in dev mode', async () => {
    const lines: string[] = [];
    const out = await sendBuildLink(null, args, { ...quiet, info: (l: string) => void lines.push(l) });
    assert.deepEqual(out, { kind: 'dev' });
    assert.ok(lines[0].includes(args.link));
    assert.ok(!lines[0].includes(args.to));
  });
});

describe('addUpdatesContact', () => {
  it('skips without a client or a segment', async () => {
    const { c, calls } = client();
    assert.equal(await addUpdatesContact(null, 'a@b.test', 'seg_1', quiet), 'skipped');
    assert.equal(await addUpdatesContact(c, 'a@b.test', null, quiet), 'skipped');
    assert.equal(calls.length, 0);
  });

  it('creates the contact in the segment', async () => {
    const { c, calls } = client();
    assert.equal(await addUpdatesContact(c, 'a@b.test', 'seg_1', quiet), 'added');
    assert.deepEqual(calls.map((x) => [x.method, ...x.args]), [['createContact', 'a@b.test', 'seg_1']]);
  });

  it('adds an existing contact to the segment, and never throws', async () => {
    const exists = { data: null, error: { message: 'exists', name: 'validation_error' } };
    const { c, calls } = client({ createContact: async () => exists });
    assert.equal(await addUpdatesContact(c, 'a@b.test', 'seg_1', quiet), 'added');
    assert.equal(calls.at(-1)?.method, 'addContactToSegment');

    const { c: broken } = client({ createContact: async () => exists, addContactToSegment: async () => exists });
    assert.equal(await addUpdatesContact(broken, 'a@b.test', 'seg_1', quiet), 'failed');
    const { c: throwing } = client({ createContact: async () => { throw new Error('x'); } });
    assert.equal(await addUpdatesContact(throwing, 'a@b.test', 'seg_1', quiet), 'failed');
  });
});
```

`adk-web-ui/lib/build/notify.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notifyOwner } from './notify.ts';
import { BUILD } from './test-fixtures.ts';

const n = { id: 'save-1', email: 'delivered@resend.dev', signedIn: false, build: BUILD, updates: true, help: true };

describe('notifyOwner', () => {
  it('is a no-op without a webhook url', async () => {
    let called = false;
    const sent = await notifyOwner(n, {}, (async () => ((called = true), new Response())) as typeof fetch);
    assert.equal(sent, false);
    assert.equal(called, false);
  });

  it('posts build.saved with the bearer secret and throws on non-2xx', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const ok = (async (url: string, init: RequestInit) => (calls.push({ url, init }), new Response('ok'))) as unknown as typeof fetch;
    assert.equal(await notifyOwner(n, { url: 'https://hook.test/x', secret: 's3' }, ok), true);
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer s3');
    const payload = JSON.parse(String(calls[0].init.body));
    assert.deepEqual(
      { type: payload.type, id: payload.id, email: payload.email, signedIn: payload.signedIn, projectName: payload.projectName, updates: payload.updates, help: payload.help },
      { type: 'build.saved', id: 'save-1', email: 'delivered@resend.dev', signedIn: false, projectName: 'research-summarizer', updates: true, help: true },
    );
    assert.ok(payload.markdown.includes('# research-summarizer'));

    const fail = (async () => new Response('no', { status: 500 })) as typeof fetch;
    await assert.rejects(notifyOwner(n, { url: 'https://hook.test/x' }, fail));
  });
});
```

`adk-web-ui/lib/build/zip-part.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { partBytes } from './zip-part.ts';

const EOCD = Buffer.concat([Buffer.from([0x50, 0x4b, 5, 6]), Buffer.alloc(18)]);

describe('partBytes', () => {
  it('decodes ADK url-safe base64 in either casing', () => {
    assert.deepEqual(partBytes({ inlineData: { mimeType: 'application/zip', data: EOCD.toString('base64url') } }), EOCD);
    assert.deepEqual(partBytes({ inline_data: { mime_type: 'application/zip', data: EOCD.toString('base64') } }), EOCD);
  });

  it('returns null when there are no bytes', () => {
    assert.equal(partBytes(null), null);
    assert.equal(partBytes({ text: 'x' }), null);
    assert.equal(partBytes({ inlineData: { data: '' } }), null);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --import tsx --test lib/build/config.test.ts lib/build/token.test.ts lib/build/request.test.ts lib/build/email.test.ts lib/build/sender.test.ts lib/build/notify.test.ts lib/build/zip-part.test.ts`
Expected: FAIL with `Cannot find module` for each new module.

- [ ] **Step 4: Implement config, token and request validation**

`adk-web-ui/lib/build/config.ts`:

```ts
import type { BuildSaveLimits } from './request';

/**
 * Every deployment-specific value of "Email me my build" comes from env
 * (documented in adk-web-ui/env.example). Nothing here names a domain,
 * sender, site URL, booking link or segment.
 */
export const DEFAULT_MAX_ZIP_BYTES = 10 * 1024 * 1024;

type Env = Record<string, string | undefined>;

export type BuildEmailConfig = { apiKey: string; from: string; replyTo: string | null };

export type BuildConfig = {
  /** null = dev mode: no email provider; the link is logged and returned. */
  email: BuildEmailConfig | null;
  segmentId: string | null;
  maxZipBytes: number;
  webhook: { url?: string; secret?: string };
  bookingUrl: string | null;
  /** NEXT_PUBLIC_BASE_URL without a trailing slash; null = use the request origin. */
  baseUrl: string | null;
  limits: BuildSaveLimits;
};

function value(env: Env, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = env[name]?.trim();
    if (v) return v;
  }
  return undefined;
}

function positiveInt(env: Env, names: string[], fallback: number): number {
  const raw = value(env, ...names);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Only https booking links are shown to visitors. */
export function safeBookingUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeBaseUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function buildConfig(env: Env = process.env): BuildConfig {
  const apiKey = value(env, 'RESEND_API_KEY');
  const from = value(env, 'BUILD_EMAIL_FROM');
  // The secret belongs to whichever webhook URL is used.
  const webhook = value(env, 'BUILD_WEBHOOK_URL')
    ? { url: value(env, 'BUILD_WEBHOOK_URL'), secret: value(env, 'BUILD_WEBHOOK_SECRET') }
    : { url: value(env, 'BLUEPRINT_WEBHOOK_URL'), secret: value(env, 'BLUEPRINT_WEBHOOK_SECRET') };
  return {
    email: apiKey && from ? { apiKey, from, replyTo: value(env, 'BUILD_EMAIL_REPLY_TO') ?? null } : null,
    segmentId: value(env, 'RESEND_SEGMENT_ID') ?? null,
    maxZipBytes: positiveInt(env, ['BUILD_MAX_ZIP_BYTES'], DEFAULT_MAX_ZIP_BYTES),
    webhook,
    bookingUrl: safeBookingUrl(value(env, 'BUILD_BOOKING_URL', 'BLUEPRINT_BOOKING_URL')),
    baseUrl: safeBaseUrl(value(env, 'NEXT_PUBLIC_BASE_URL')),
    limits: {
      user: positiveInt(env, ['BUILD_SAVE_USER_DAILY', 'BLUEPRINT_SAVE_USER_DAILY'], 10),
      anon: positiveInt(env, ['BUILD_SAVE_ANON_DAILY', 'BLUEPRINT_SAVE_ANON_DAILY'], 3),
      anonIp: positiveInt(env, ['BUILD_SAVE_ANON_IP_DAILY', 'BLUEPRINT_SAVE_ANON_IP_DAILY'], 10),
    },
  };
}

export function buildLink(base: string, token: string): string {
  return `${base}/builds/${token}`;
}
```

`adk-web-ui/lib/build/token.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

/** The link token goes to the visitor's inbox; only its sha256 is stored. */
export type BuildToken = { token: string; hash: string };

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isBuildToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_RE.test(value);
}

export function hashBuildToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newBuildToken(bytes: (size: number) => Buffer = randomBytes): BuildToken {
  const token = bytes(32).toString('base64url');
  return { token, hash: hashBuildToken(token) };
}
```

`adk-web-ui/lib/build/request.ts`:

```ts
import type { Identity } from '../identity';
import type { Bucket } from '../limits/limiter';

/** The whole POST /api/builds body: the client never sends the build or the zip. */
export type BuildSaveRequest = { email: string; sessionId: string; updates: boolean; help: boolean };

export type BuildRequestResult =
  | { ok: true; value: BuildSaveRequest }
  | { ok: false; reason: 'body' | 'email' | 'session' };

export type BuildSaveLimits = { user: number; anon: number; anonIp: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_EMAIL = 254;

/** Reasons are safe to log (no PII). */
export function validateBuildRequest(body: unknown): BuildRequestResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'body' };
  const b = body as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) return { ok: false, reason: 'email' };
  if (typeof b.sessionId !== 'string' || !SESSION_RE.test(b.sessionId)) return { ok: false, reason: 'session' };
  return { ok: true, value: { email, sessionId: b.sessionId, updates: b.updates === true, help: b.help === true } };
}

/** Daily buckets; the `bd:` prefix is redacted by lib/sentry-scrub.ts. */
export function buildSaveBuckets(identity: Identity, limits: BuildSaveLimits): Bucket[] {
  if (identity.kind === 'user') return [{ key: `bd:u:${identity.userId}`, limit: limits.user }];
  const buckets: Bucket[] = [{ key: `bd:a:${identity.anonToken}`, limit: limits.anon }];
  if (identity.ipHash) buckets.push({ key: `bd:ip:${identity.ipHash}`, limit: limits.anonIp });
  return buckets;
}
```

- [ ] **Step 5: Implement the email body, sender, Resend adapter and webhook**

`adk-web-ui/lib/build/email.ts`:

```ts
import type { Build } from './types';
import { enabledOptions, plural, runSteps } from './summary';

export type BuildLinkMessage = { subject: string; html: string; text: string };

const PRIVATE_NOTE =
  'Anyone with this link can download the build, so keep it to yourself. You can delete the build from that page.';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The link email. The only URL in it is `link`, and the site is named by
 * that link's host, so nothing deployment-specific is baked in.
 */
export function buildLinkEmail(build: Build, link: string): BuildLinkMessage {
  const site = new URL(link).host;
  const options = enabledOptions(build);
  const facts = [plural(build.files, 'file'), plural(build.tools.length, 'tool'), plural(build.skills.length, 'skill')]
    .concat(options)
    .join(' · ');
  const steps = runSteps(build.artifact);

  const lines = [`Here is the agent you built on ${site}: ${build.name}.`];
  if (build.description) lines.push('', build.description);
  lines.push('', facts, '', `Download it any time: ${link}`, PRIVATE_NOTE, '', 'Run it locally:');
  lines.push(...steps.map((s, i) => `${i + 1}. ${s}`));

  const html = [
    `<p>Here is the agent you built on ${escapeHtml(site)}: <strong>${escapeHtml(build.name)}</strong>.</p>`,
    build.description ? `<p>${escapeHtml(build.description)}</p>` : '',
    `<p>${escapeHtml(facts)}</p>`,
    `<p><a href="${escapeHtml(link)}">Download ${escapeHtml(build.artifact)}</a></p>`,
    `<p>${escapeHtml(PRIVATE_NOTE)}</p>`,
    '<p>Run it locally:</p>',
    `<ol>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject: `Your agent: ${build.name}`, html, text: lines.join('\n') + '\n' };
}
```

`adk-web-ui/lib/build/sender.ts`:

```ts
import type { BuildLinkMessage } from './email';

export type ResendError = { message: string; name?: string };
/** The Resend SDK's return shape: it reports API errors here instead of throwing. */
export type ResendResult<T> = { data: T | null; error: ResendError | null };

/** The slice of the Resend SDK this feature uses (implemented in resend-client.ts). */
export type EmailClient = {
  sendEmail(
    payload: { from: string; to: string[]; subject: string; html: string; text: string; replyTo?: string },
    idempotencyKey: string,
  ): Promise<ResendResult<{ id: string }>>;
  createContact(email: string, segmentId: string): Promise<ResendResult<unknown>>;
  addContactToSegment(email: string, segmentId: string): Promise<ResendResult<unknown>>;
};

export type EmailSender = { client: EmailClient; from: string; replyTo: string | null };

export type SendOutcome = { kind: 'sent'; emailId: string | null } | { kind: 'dev' } | { kind: 'failed'; reason: string };

export type SendLinkArgs = { saveId: string; to: string; link: string; message: BuildLinkMessage };

type Log = Pick<Console, 'info' | 'warn' | 'error'>;

export function idempotencyKey(saveId: string): string {
  return `build-link/${saveId}`;
}

/** Email the link; with no sender configured (dev mode) log it instead. */
export async function sendBuildLink(sender: EmailSender | null, args: SendLinkArgs, log: Log = console): Promise<SendOutcome> {
  if (!sender) {
    log.info(`[builds] email is not configured (dev mode); link for save ${args.saveId}: ${args.link}`);
    return { kind: 'dev' };
  }
  try {
    const { data, error } = await sender.client.sendEmail(
      {
        from: sender.from,
        to: [args.to],
        subject: args.message.subject,
        html: args.message.html,
        text: args.message.text,
        ...(sender.replyTo ? { replyTo: sender.replyTo } : {}),
      },
      idempotencyKey(args.saveId),
    );
    if (error) {
      log.warn(`[builds] link email failed save=${args.saveId} error=${error.name ?? 'unknown'}`);
      return { kind: 'failed', reason: error.name ?? 'error' };
    }
    return { kind: 'sent', emailId: data?.id ?? null };
  } catch (e) {
    log.error(`[builds] link email threw save=${args.saveId} error=${e instanceof Error ? e.name : 'unknown'}`);
    return { kind: 'failed', reason: 'exception' };
  }
}

/** Opt-in to updates: add the contact to the segment. Never throws. */
export async function addUpdatesContact(
  client: EmailClient | null,
  email: string,
  segmentId: string | null,
  log: Log = console,
): Promise<'added' | 'skipped' | 'failed'> {
  if (!client || !segmentId) return 'skipped';
  try {
    const created = await client.createContact(email, segmentId);
    if (!created.error) return 'added';
    // Usually the contact exists already: add it to the segment instead.
    const added = await client.addContactToSegment(email, segmentId);
    if (!added.error) return 'added';
    log.warn(`[builds] could not add contact to segment error=${added.error.name ?? 'unknown'}`);
    return 'failed';
  } catch (e) {
    log.warn(`[builds] contact call threw error=${e instanceof Error ? e.name : 'unknown'}`);
    return 'failed';
  }
}
```

`adk-web-ui/lib/build/resend-client.ts`:

```ts
import { Resend } from 'resend';
import type { EmailClient } from './sender';

/** Server only: the Resend API has no CORS on purpose, and the key is secret. */
export function resendEmailClient(apiKey: string): EmailClient {
  const resend = new Resend(apiKey);
  return {
    sendEmail: (payload, idempotencyKey) => resend.emails.send(payload, { idempotencyKey }),
    createContact: (email, segmentId) =>
      resend.contacts.create({ email, unsubscribed: false, segments: [{ id: segmentId }] }),
    addContactToSegment: (email, segmentId) => resend.contacts.segments.add({ email, segmentId }),
  };
}
```

`adk-web-ui/lib/build/notify.ts`:

```ts
import type { Build } from './types';
import { buildToMarkdown } from './summary';

const TIMEOUT_MS = 5000;

export type OwnerNotification = {
  id: string;
  email: string;
  signedIn: boolean;
  build: Build;
  updates: boolean;
  help: boolean;
};

/**
 * Tell the site owner about an emailed build by POSTing JSON to the
 * configured webhook (any Slack/Zapier/email relay); the optional secret is
 * sent as a bearer token. Returns false when no webhook is configured;
 * throws on failure so the caller can record it.
 */
export async function notifyOwner(
  n: OwnerNotification,
  env: { url?: string; secret?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.url) return false;
  const res = await fetchImpl(env.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.secret ? { Authorization: `Bearer ${env.secret}` } : {}),
    },
    body: JSON.stringify({
      type: 'build.saved',
      id: n.id,
      email: n.email,
      signedIn: n.signedIn,
      projectName: n.build.name,
      updates: n.updates,
      help: n.help,
      // Slack-style relays need a text field.
      text: `New build "${n.build.name}" emailed to ${n.email}${n.help ? ' (asked for help deploying)' : ''}`,
      markdown: buildToMarkdown(n.build),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`webhook responded ${res.status}`);
  return true;
}
```

- [ ] **Step 6: Implement zip decoding and the ADK reads**

`adk-web-ui/lib/build/zip-part.ts`:

```ts
import { toStandardBase64 } from '../artifact-base64';

type InlineData = { data?: unknown };

/** Bytes of an ADK artifact `Part` (inlineData or inline_data, url-safe base64). */
export function partBytes(part: unknown): Buffer | null {
  if (!part || typeof part !== 'object') return null;
  const p = part as { inlineData?: InlineData; inline_data?: InlineData };
  const data = (p.inlineData ?? p.inline_data)?.data;
  if (typeof data !== 'string' || data.length === 0) return null;
  const bytes = Buffer.from(toStandardBase64(data), 'base64');
  return bytes.length > 0 ? bytes : null;
}
```

`adk-web-ui/lib/build/adk-build.ts`:

```ts
import { adkFetch } from '@/lib/adk-config';
import { adkPath, assertArtifactName } from '@/lib/adk-url';
import { BUILDER_AGENT } from '@/lib/builder';
import { parseBuild } from './parse';
import { BUILD_STATE_KEY, type Build, type SessionBuildLookup, type ZipLookup } from './types';
import { partBytes } from './zip-part';

/** `builder:build` from the caller's own ADK session (adkUserId comes from identity, never the client). */
export async function loadSessionBuild(adkUserId: string, sessionId: string): Promise<SessionBuildLookup> {
  try {
    const res = await adkFetch(adkPath('apps', BUILDER_AGENT, 'users', adkUserId, 'sessions', sessionId), {
      method: 'GET',
      timeoutMs: 10_000,
    });
    if (res.status === 404) return { kind: 'missing' };
    if (!res.ok) return { kind: 'unavailable' };
    const session = (await res.json()) as { state?: Record<string, unknown> } | null;
    const build = parseBuild(session?.state?.[BUILD_STATE_KEY]);
    return build ? { kind: 'ok', build } : { kind: 'missing' };
  } catch {
    return { kind: 'unavailable' };
  }
}

/** The zip artifact by name and version; `gone` after a backend restart. */
export async function fetchBuildZip(
  adkUserId: string,
  sessionId: string,
  build: Pick<Build, 'artifact' | 'version'>,
): Promise<ZipLookup> {
  try {
    const name = assertArtifactName(build.artifact);
    const base = adkPath('apps', BUILDER_AGENT, 'users', adkUserId, 'sessions', sessionId, 'artifacts', name);
    const res = await adkFetch(`${base}?version=${build.version}`, { method: 'GET', timeoutMs: 30_000 });
    if (res.status === 404) return { kind: 'gone' };
    if (!res.ok) return { kind: 'unavailable' };
    const bytes = partBytes(await res.json());
    return bytes ? { kind: 'ok', bytes } : { kind: 'gone' };
  } catch {
    return { kind: 'unavailable' };
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --import tsx --test lib/build/config.test.ts lib/build/token.test.ts lib/build/request.test.ts lib/build/email.test.ts lib/build/sender.test.ts lib/build/notify.test.ts lib/build/zip-part.test.ts`
Expected: PASS.

Then: `npx tsc --noEmit && npm run lint`
Expected: clean (this also checks that `resend-client.ts` matches the installed SDK's types: `emails.send(payload, { idempotencyKey })`, `contacts.create({ email, unsubscribed, segments })`, `contacts.segments.add({ email, segmentId })`).

- [ ] **Step 8: Commit**

```bash
git add adk-web-ui/package.json adk-web-ui/package-lock.json adk-web-ui/lib/build
git commit -m "feat(builds): env config, link token, request validation, Resend sender

Adds the resend SDK. The sender checks the SDK's {error} result, uses the
build-link/<save id> idempotency key and falls back to logging the link
when RESEND_API_KEY/BUILD_EMAIL_FROM are unset.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `POST /api/builds`

**Files:**
- Create: `adk-web-ui/lib/build/save-handler.ts`, test `adk-web-ui/lib/build/save-handler.test.ts`
- Create: `adk-web-ui/app/api/builds/route.ts`

**Interfaces:**
- Consumes: Task 1 (`Build`, `NewBuildSave`, `SessionBuildLookup`, `ZipLookup`), Task 3 (`'gone'` code, `buildSaveStore`), Task 4 (`BuildConfig`, `buildConfig`, `buildLink`, `BuildToken`, `newBuildToken`, `validateBuildRequest`, `buildSaveBuckets`, `buildLinkEmail`, `SendOutcome`, `SendLinkArgs`, `sendBuildLink`, `addUpdatesContact`, `resendEmailClient`, `OwnerNotification`, `notifyOwner`, `loadSessionBuild`, `fetchBuildZip`); `lib/identity.ts` (`Identity`, `ResolvedIdentity`, `adkUserIdForSession`, `applyIdentityCookie`); `lib/limits/limiter.ts` (`Bucket`, `BucketResult`, `Reservation`, `reserveBuckets`, `releaseReservation`).
- Produces: `handleSaveBuild(body: unknown, deps: SaveBuildDeps): Promise<SaveBuildResult>`; response `{ success: true, data: { id: string; sent: boolean; bookingUrl?: string; link?: string } }` (consumed by Task 6's dialog and Task 9's e2e).

- [ ] **Step 1: Write the failing handler tests**

`adk-web-ui/lib/build/save-handler.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleSaveBuild, type SaveBuildDeps } from './save-handler.ts';
import { buildConfig } from './config.ts';
import { BUILD } from './test-fixtures.ts';
import type { NewBuildSave } from './types.ts';
import type { SendLinkArgs } from './sender.ts';
import type { OwnerNotification } from './notify.ts';

const ZIP = Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
const TOKEN = 't'.repeat(43);
const body = { email: ' Me@Example.com ', sessionId: 'session-123', updates: false, help: false };

function setup(over: Partial<SaveBuildDeps> = {}, env: Record<string, string> = {}) {
  const calls = {
    loaded: 0,
    released: 0,
    inserted: [] as NewBuildSave[],
    sent: [] as SendLinkArgs[],
    emailSent: [] as string[],
    contacts: [] as string[],
    notified: [] as OwnerNotification[],
    markedNotified: [] as string[],
  };
  const deps: SaveBuildDeps = {
    config: buildConfig({ NEXT_PUBLIC_BASE_URL: 'https://site.test', ...env }),
    origin: 'http://localhost:3000',
    dbEnabled: () => true,
    resolveIdentity: async () => ({ identity: { kind: 'anon', anonToken: 'a'.repeat(64), ipHash: 'ip' }, newAnonToken: null }),
    adkUserId: async (identity) => (identity.kind === 'user' ? `u_${identity.userId}` : `a_${identity.anonToken}`),
    reserve: async () => ({ ok: true, reservation: { day: '2026-10-04', keys: ['bd:a:x'] } }),
    release: async () => {
      calls.released++;
    },
    loadBuild: async () => {
      calls.loaded++;
      return { kind: 'ok', build: BUILD };
    },
    fetchZip: async () => ({ kind: 'ok', bytes: ZIP }),
    store: {
      insert: async (r) => (calls.inserted.push(r), { id: 'save-1' }),
      markEmailSent: async (id) => void calls.emailSent.push(id),
      markNotified: async (id) => void calls.markedNotified.push(id),
    },
    newToken: () => ({ token: TOKEN, hash: 'h'.repeat(64) }),
    sendLink: async (a) => (calls.sent.push(a), { kind: 'sent', emailId: 'em_1' }),
    addContact: async (email) => void calls.contacts.push(email),
    notify: async (n) => (calls.notified.push(n), true),
    now: () => new Date('2026-10-04T10:00:00Z'),
    log: { warn() {}, error() {} },
    ...over,
  };
  return { deps, calls };
}

describe('handleSaveBuild', () => {
  it('stores the zip from the session and emails the link', async () => {
    const { deps, calls } = setup();
    const r = await handleSaveBuild(body, deps);
    assert.ok(r.ok);
    assert.deepEqual(r.data, { id: 'save-1', sent: true });
    assert.equal(calls.inserted.length, 1);
    const row = calls.inserted[0];
    assert.equal(row.email, 'me@example.com');
    assert.equal(row.tokenHash, 'h'.repeat(64));
    assert.equal(row.userId, null);
    assert.equal(row.sessionId, 'session-123');
    assert.equal(row.build, BUILD);
    assert.deepEqual(row.zip, ZIP);
    assert.equal(row.updatesConsentAt, null);
    assert.equal(row.helpRequested, false);
    assert.equal(calls.sent[0].link, `https://site.test/builds/${TOKEN}`);
    assert.equal(calls.sent[0].to, 'me@example.com');
    assert.equal(calls.sent[0].message.subject, 'Your agent: research-summarizer');
    assert.deepEqual(calls.emailSent, ['save-1']);
    assert.deepEqual(calls.markedNotified, ['save-1']);
    assert.equal(calls.released, 0);
  });

  it('does not call the contacts API without updates, and does with it', async () => {
    const off = setup();
    await handleSaveBuild(body, off.deps);
    assert.deepEqual(off.calls.contacts, []);

    const on = setup();
    await handleSaveBuild({ ...body, updates: true }, on.deps);
    assert.deepEqual(on.calls.contacts, ['me@example.com']);
    assert.equal(on.calls.inserted[0].updatesConsentAt?.toISOString(), '2026-10-04T10:00:00.000Z');
  });

  it('returns the booking link only when help was asked for', async () => {
    const env = { BUILD_BOOKING_URL: 'https://book.test/me' };
    const without = await handleSaveBuild(body, setup({}, env).deps);
    assert.ok(without.ok && !('bookingUrl' in without.data));
    const withHelp = setup({}, env);
    const r = await handleSaveBuild({ ...body, help: true }, withHelp.deps);
    assert.ok(r.ok);
    assert.equal(r.data.bookingUrl, 'https://book.test/me');
    assert.equal(withHelp.calls.inserted[0].helpRequested, true);
    assert.equal(withHelp.calls.notified[0].help, true);
  });

  it('404s when the session has no build', async () => {
    const { deps, calls } = setup({ loadBuild: async () => ({ kind: 'missing' }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'not_found');
    assert.equal(calls.released, 1);
    assert.equal(calls.inserted.length, 0);
  });

  it('410s when the artifact is gone', async () => {
    const { deps, calls } = setup({ fetchZip: async () => ({ kind: 'gone' }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'gone');
    assert.match(r.message ?? '', /package it again/);
    assert.equal(calls.released, 1);
    assert.equal(calls.inserted.length, 0);
  });

  it('rejects zips over BUILD_MAX_ZIP_BYTES', async () => {
    const { deps, calls } = setup({}, { BUILD_MAX_ZIP_BYTES: '10' });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_input');
    assert.match(r.message ?? '', /too large/);
    assert.equal(calls.released, 1);
  });

  it('stops at the daily limit before touching ADK', async () => {
    const { deps, calls } = setup({ reserve: async () => ({ ok: false, reason: 'limit', limit: 3 }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'rate_limited');
    assert.equal(calls.loaded, 0);
    assert.ok(r.resolved, 'identity is returned so the route can set the cookie');
  });

  it('keeps the row, releases the reservation and asks to retry when sending fails', async () => {
    const { deps, calls } = setup({ sendLink: async () => ({ kind: 'failed', reason: 'validation_error' }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'temporarily_unavailable');
    assert.match(r.message ?? '', /couldn't send/i);
    assert.equal(calls.inserted.length, 1);
    assert.deepEqual(calls.emailSent, []);
    assert.equal(calls.released, 1);
  });

  it('returns the link in dev mode and uses the request origin without NEXT_PUBLIC_BASE_URL', async () => {
    const { deps, calls } = setup({ config: buildConfig({}), sendLink: async () => ({ kind: 'dev' }) });
    const r = await handleSaveBuild(body, deps);
    assert.ok(r.ok);
    assert.deepEqual(r.data, { id: 'save-1', sent: false, link: `http://localhost:3000/builds/${TOKEN}` });
    assert.deepEqual(calls.emailSent, []);
  });

  it('a failed owner notification does not fail the request', async () => {
    const { deps, calls } = setup({ notify: async () => { throw new Error('down'); } });
    const r = await handleSaveBuild(body, deps);
    assert.ok(r.ok);
    assert.deepEqual(calls.markedNotified, []);
  });

  it('records the signed-in user', async () => {
    const { deps, calls } = setup({ resolveIdentity: async () => ({ identity: { kind: 'user', userId: 'u1' }, newAnonToken: null }) });
    await handleSaveBuild(body, deps);
    assert.equal(calls.inserted[0].userId, 'u1');
    assert.equal(calls.notified[0].signedIn, true);
  });

  it('validates before anything else, then needs a database', async () => {
    const bad = setup();
    const r = await handleSaveBuild({ ...body, email: 'nope' }, bad.deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'invalid_input');
    assert.match(r.message ?? '', /valid email/);
    assert.equal(r.resolved, null);

    const noDb = await handleSaveBuild(body, setup({ dbEnabled: () => false }).deps);
    assert.ok(!noDb.ok);
    assert.equal(noDb.code, 'temporarily_unavailable');
  });

  it('releases the reservation when storage fails', async () => {
    const { deps, calls } = setup({
      store: {
        insert: async () => { throw new Error('db'); },
        markEmailSent: async () => {},
        markNotified: async () => {},
      },
    });
    const r = await handleSaveBuild(body, deps);
    assert.ok(!r.ok);
    assert.equal(r.code, 'internal');
    assert.equal(calls.released, 1);
    assert.equal(calls.sent.length, 0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test lib/build/save-handler.test.ts`
Expected: FAIL with `Cannot find module './save-handler.ts'`.

- [ ] **Step 3: Implement the handler**

`adk-web-ui/lib/build/save-handler.ts`:

```ts
import type { ApiErrorCode } from '../api-error';
import type { Identity, ResolvedIdentity } from '../identity';
import type { Bucket, BucketResult, Reservation } from '../limits/limiter';
import { buildLink, type BuildConfig } from './config';
import { buildLinkEmail } from './email';
import type { OwnerNotification } from './notify';
import { buildSaveBuckets, validateBuildRequest } from './request';
import type { SendLinkArgs, SendOutcome } from './sender';
import type { BuildToken } from './token';
import type { Build, NewBuildSave, SessionBuildLookup, ZipLookup } from './types';

const NO_BUILD = "This chat doesn't have a packaged agent yet. Ask the builder to build it first.";
const ZIP_GONE = 'The zip is no longer on the server (the builder restarted). Ask the builder to package it again.';
const TOO_LARGE = 'This build is too large to email.';
const SEND_FAILED = "We couldn't send the email. Try again in a moment.";
const LIMIT = "You've emailed the maximum number of builds for today.";

/** Everything POST /api/builds touches, injected so the flow is testable without Next, ADK, Postgres or Resend. */
export type SaveBuildDeps = {
  config: BuildConfig;
  /** Base for the link when NEXT_PUBLIC_BASE_URL is unset. */
  origin: string;
  dbEnabled(): boolean;
  resolveIdentity(): Promise<ResolvedIdentity>;
  adkUserId(identity: Identity, sessionId: string): Promise<string>;
  reserve(buckets: Bucket[]): Promise<BucketResult>;
  release(reservation: Reservation): Promise<void>;
  loadBuild(adkUserId: string, sessionId: string): Promise<SessionBuildLookup>;
  fetchZip(adkUserId: string, sessionId: string, build: Build): Promise<ZipLookup>;
  store: {
    insert(record: NewBuildSave): Promise<{ id: string }>;
    markEmailSent(id: string): Promise<void>;
    markNotified(id: string): Promise<void>;
  };
  newToken(): BuildToken;
  sendLink(args: SendLinkArgs): Promise<SendOutcome>;
  /** Adds an opted-in contact; must never throw. */
  addContact(email: string): Promise<unknown>;
  /** false when no webhook is configured; throws on failure. */
  notify(n: OwnerNotification): Promise<boolean>;
  now?(): Date;
  log?: Pick<Console, 'warn' | 'error'>;
};

export type SaveBuildData = { id: string; sent: boolean; bookingUrl?: string; link?: string };

export type SaveBuildResult = { resolved: ResolvedIdentity | null } & (
  | { ok: true; data: SaveBuildData }
  | { ok: false; code: ApiErrorCode; message?: string; log?: unknown }
);

function fail(resolved: ResolvedIdentity | null, code: ApiErrorCode, message?: string, log?: unknown): SaveBuildResult {
  return { resolved, ok: false, code, message, log };
}

/**
 * Steps 2-11 of POST /api/builds (the route does the cross-origin guard and
 * JSON parsing). Logs carry ids and reasons only, never the email or zip.
 */
export async function handleSaveBuild(body: unknown, deps: SaveBuildDeps): Promise<SaveBuildResult> {
  const log = deps.log ?? console;

  const parsed = validateBuildRequest(body);
  if (!parsed.ok) {
    return fail(null, 'invalid_input', parsed.reason === 'email' ? 'Please enter a valid email address.' : undefined, `invalid ${parsed.reason}`);
  }
  if (!deps.dbEnabled()) return fail(null, 'temporarily_unavailable', undefined, 'no database');

  const { email, sessionId, updates, help } = parsed.value;
  const resolved = await deps.resolveIdentity();
  const reservation = await deps.reserve(buildSaveBuckets(resolved.identity, deps.config.limits));
  if (!reservation.ok) {
    return reservation.reason === 'limit'
      ? fail(resolved, 'rate_limited', LIMIT)
      : fail(resolved, 'temporarily_unavailable', undefined, 'limiter unavailable');
  }
  const failAndRelease = async (code: ApiErrorCode, message?: string, why?: unknown) => {
    await deps.release(reservation.reservation);
    return fail(resolved, code, message, why);
  };

  try {
    // The caller's own session: the ADK user id comes from identity, never the client.
    const adkUserId = await deps.adkUserId(resolved.identity, sessionId);
    const lookup = await deps.loadBuild(adkUserId, sessionId);
    if (lookup.kind === 'missing') return await failAndRelease('not_found', NO_BUILD, 'no build in session');
    if (lookup.kind === 'unavailable') return await failAndRelease('backend_unavailable', undefined, 'session lookup failed');
    const build = lookup.build;
    if (build.bytes > deps.config.maxZipBytes) return await failAndRelease('invalid_input', TOO_LARGE, 'zip too large');

    const zip = await deps.fetchZip(adkUserId, sessionId, build);
    if (zip.kind === 'gone') return await failAndRelease('gone', ZIP_GONE, 'artifact gone');
    if (zip.kind === 'unavailable') return await failAndRelease('backend_unavailable', undefined, 'artifact fetch failed');
    if (zip.bytes.length > deps.config.maxZipBytes) return await failAndRelease('invalid_input', TOO_LARGE, 'zip too large');

    const now = (deps.now ?? (() => new Date()))();
    const token = deps.newToken();
    const { id } = await deps.store.insert({
      tokenHash: token.hash,
      email,
      userId: resolved.identity.kind === 'user' ? resolved.identity.userId : null,
      sessionId,
      build,
      zip: zip.bytes,
      updatesConsentAt: updates ? now : null,
      helpRequested: help,
    });

    const link = buildLink(deps.config.baseUrl ?? deps.origin, token.token);
    const sent = await deps.sendLink({ saveId: id, to: email, link, message: buildLinkEmail(build, link) });
    // The row stays with email_sent_at null; the user can try again.
    if (sent.kind === 'failed') {
      return await failAndRelease('temporarily_unavailable', SEND_FAILED, `send failed id=${id} reason=${sent.reason}`);
    }
    if (sent.kind === 'sent') {
      try {
        await deps.store.markEmailSent(id);
      } catch {
        log.warn(`[builds] could not mark email sent id=${id}`);
      }
    }

    if (updates) await deps.addContact(email);

    try {
      const notified = await deps.notify({ id, email, signedIn: resolved.identity.kind === 'user', build, updates, help });
      if (notified) await deps.store.markNotified(id);
    } catch {
      log.warn(`[builds] owner notification failed id=${id}`);
    }

    const data: SaveBuildData = { id, sent: sent.kind === 'sent' };
    if (help && deps.config.bookingUrl) data.bookingUrl = deps.config.bookingUrl;
    if (sent.kind === 'dev') data.link = link;
    return { resolved, ok: true, data };
  } catch (error) {
    // The error may echo inserted values; log only its type.
    return failAndRelease('internal', undefined, error instanceof Error ? error.name : 'unknown');
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test lib/build/save-handler.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the route**

`adk-web-ui/app/api/builds/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { isDbEnabled } from '@/lib/db';
import { adkUserIdForSession, applyIdentityCookie } from '@/lib/identity';
import { resolveIdentity } from '@/lib/identity-server';
import { dbCounterStore } from '@/lib/limits/db-store';
import { releaseReservation, reserveBuckets } from '@/lib/limits/limiter';
import { rejectCrossOrigin } from '@/lib/origin-guard';
import { findOwnedAdkUserId } from '@/lib/sessions';
import { fetchBuildZip, loadSessionBuild } from '@/lib/build/adk-build';
import { buildConfig } from '@/lib/build/config';
import { buildSaveStore } from '@/lib/build/db-store';
import { notifyOwner } from '@/lib/build/notify';
import { resendEmailClient } from '@/lib/build/resend-client';
import { handleSaveBuild } from '@/lib/build/save-handler';
import { addUpdatesContact, sendBuildLink } from '@/lib/build/sender';
import { newBuildToken } from '@/lib/build/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * "Email me a permanent link": store the caller's latest build zip and email
 * them a private link to it. Body: {email, sessionId, updates, help}; the
 * build and zip are read server side from the caller's own ADK session.
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('invalid_input', requestId, { log: 'invalid json' });
  }

  const config = buildConfig();
  const client = config.email ? resendEmailClient(config.email.apiKey) : null;
  const sender = client && config.email ? { client, from: config.email.from, replyTo: config.email.replyTo } : null;

  const result = await handleSaveBuild(body, {
    config,
    origin: request.nextUrl.origin,
    dbEnabled: isDbEnabled,
    resolveIdentity: () => resolveIdentity(request),
    adkUserId: (identity, sessionId) => adkUserIdForSession(identity, sessionId, findOwnedAdkUserId),
    reserve: (buckets) => reserveBuckets(buckets, { store: dbCounterStore }),
    release: (reservation) => releaseReservation(reservation, dbCounterStore),
    loadBuild: loadSessionBuild,
    fetchZip: fetchBuildZip,
    store: buildSaveStore,
    newToken: () => newBuildToken(),
    sendLink: (args) => sendBuildLink(sender, args),
    addContact: (email) => addUpdatesContact(client, email, config.segmentId),
    notify: (n) => notifyOwner(n, config.webhook),
  });

  const res = result.ok
    ? NextResponse.json({ success: true, data: result.data }, { headers: { 'x-request-id': requestId } })
    : apiError(result.code, requestId, { message: result.message, log: result.log });
  if (result.resolved) applyIdentityCookie(res, result.resolved);
  return res;
}
```

- [ ] **Step 6: Verify**

Run: `npm run test:unit && npx tsc --noEmit && npm run lint`
Expected: PASS / clean.

Manual dev-mode check (needs the ADK backend running locally with the backend plan merged, and `RESEND_API_KEY` unset): build an agent in `/chat` until the build card appears, then run in the browser console on that page:
`await (await fetch('/api/builds', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:'delivered@resend.dev', sessionId: '<session-… id from the URL/network tab>', updates:false, help:false})})).json()`
Expected: `{success:true, data:{id, sent:false, link:'http://localhost:3000/builds/…'}}` and the dev server log shows `[builds] email is not configured (dev mode); link for save …`.

- [ ] **Step 7: Commit**

```bash
git add adk-web-ui/lib/build/save-handler.ts adk-web-ui/lib/build/save-handler.test.ts adk-web-ui/app/api/builds/route.ts
git commit -m "feat(builds): POST /api/builds stores the zip and emails a private link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: "Email me a permanent link" dialog on the build card

**Files:**
- Create: `adk-web-ui/components/build/EmailBuildDialog.tsx`
- Modify: `adk-web-ui/components/build/BuildCard.tsx` (full replacement below)

**Interfaces:**
- Consumes: Task 2 `BuildCard`, `downloadBuildZip`; Task 5 response `{ success, data: { id, sent, bookingUrl?, link? } }` or error `{ success: false, error: string }`.
- Produces: `EmailBuildDialog({ open, onOpenChange, build, sessionId })`; card button "Email me a permanent link"; dialog titles "Email me a permanent link" → "Check your inbox" (sent) / "Your build link" (dev mode); submit button "Send link"; checkboxes named "Send me updates about the builder and nuvel" and "I'd like help deploying it" (used by Task 9 e2e).

- [ ] **Step 1: Add the dialog**

`adk-web-ui/components/build/EmailBuildDialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CalendarDays, MailCheck } from 'lucide-react';
import type { Build } from '@/lib/build/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; email: string; sent: boolean; bookingUrl: string | null; link: string | null }
  | { kind: 'error'; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const checkboxClass = 'mt-1 size-4 accent-md-primary';
const optionClass = 'flex items-start gap-3 text-body-medium text-md-on-surface-variant';

export default function EmailBuildDialog({
  open,
  onOpenChange,
  build,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  build: Build;
  sessionId?: string;
}) {
  const { data: session } = useSession();
  // null until the user types, so a signed-in email can prefill but still be cleared.
  const [email, setEmail] = useState<string | null>(null);
  const [updates, setUpdates] = useState(false);
  const [help, setHelp] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const effectiveEmail = (email ?? session?.user?.email ?? '').trim();
  const canSubmit = Boolean(sessionId) && EMAIL_RE.test(effectiveEmail) && status.kind !== 'sending';

  const submit = async () => {
    if (!canSubmit || !sessionId) return;
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: effectiveEmail, sessionId, updates, help }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setStatus({
          kind: 'error',
          message: typeof json?.error === 'string' ? json.error : "We couldn't send the link. Try again in a moment.",
        });
        return;
      }
      const data = (json.data ?? {}) as Record<string, unknown>;
      setStatus({
        kind: 'done',
        email: effectiveEmail,
        sent: data.sent === true,
        bookingUrl: typeof data.bookingUrl === 'string' ? data.bookingUrl : null,
        link: typeof data.link === 'string' ? data.link : null,
      });
    } catch {
      setStatus({ kind: 'error', message: "We couldn't send the link. Check your connection and try again." });
    }
  };

  const done = status.kind === 'done' ? status : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next && done) setStatus({ kind: 'idle' });
      }}
    >
      <DialogContent
        title={done ? (done.sent ? 'Check your inbox' : 'Your build link') : 'Email me a permanent link'}
        description={
          done ? undefined : `We'll email you a private link to ${build.artifact}. It keeps working after this chat is gone.`
        }
      >
        {done ? (
          <div className="space-y-4">
            {done.sent ? (
              <p className="flex items-start gap-2 text-body-medium text-md-on-surface-variant">
                <MailCheck className="mt-0.5 size-5 shrink-0 text-md-primary" aria-hidden />
                We sent a link to {done.email}.
              </p>
            ) : null}
            {done.link ? (
              <div className="space-y-1">
                <p className="text-body-medium text-md-on-surface-variant">
                  Email isn&apos;t set up on this server, so here is your link:
                </p>
                <a href={done.link} className="break-all text-body-medium text-md-primary underline underline-offset-2">
                  {done.link}
                </a>
              </div>
            ) : null}
            {done.bookingUrl ? (
              <a href={done.bookingUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'filled' })}>
                <CalendarDays /> Book a call
              </a>
            ) : null}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <label className="block space-y-1.5">
              <span className="text-label-large text-md-on-surface">Email</span>
              <Input
                type="email"
                required
                autoComplete="email"
                value={email ?? session?.user?.email ?? ''}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className={optionClass}>
              <input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} className={checkboxClass} />
              <span>Send me updates about the builder and nuvel</span>
            </label>
            <label className={optionClass}>
              <input type="checkbox" checked={help} onChange={(e) => setHelp(e.target.checked)} className={checkboxClass} />
              <span>I&apos;d like help deploying it</span>
            </label>
            <p className="text-body-small text-md-on-surface-variant">
              We store your email and this build to send the link and serve the download. See the{' '}
              <Link href="/privacy#builds" target="_blank" className="text-md-primary underline underline-offset-2">
                privacy policy
              </Link>
              .
            </p>
            {status.kind === 'error' ? (
              <p role="alert" className="text-body-medium text-md-error">
                {status.message}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="text" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {status.kind === 'sending' ? 'Sending…' : 'Send link'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add the primary action to the card**

Replace `adk-web-ui/components/build/BuildCard.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { Download, Mail, Package } from 'lucide-react';
import type { Build } from '@/lib/build/types';
import { enabledOptions, formatBytes, plural } from '@/lib/build/summary';
import { BUILDER_AGENT } from '@/lib/builder';
import { toSessionId } from '@/lib/ids';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { downloadBuildZip, type DownloadResult } from './download';
import EmailBuildDialog from './EmailBuildDialog';

const DOWNLOAD_PROBLEMS: Record<Exclude<DownloadResult, 'ok'>, string> = {
  gone: 'This zip is no longer on the server (the builder restarted). Ask the builder to package it again.',
  error: 'The download failed. Try again in a moment.',
};

/** The packaged project, inline in the chat: download it, or email yourself a permanent link. */
export default function BuildCard({ build }: { build: Build }) {
  const conversationId = useAppStore((s) => s.currentConversation?.id);
  const [downloading, setDownloading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  let sessionId: string | undefined;
  try {
    sessionId = conversationId ? toSessionId(conversationId) : undefined;
  } catch {
    sessionId = undefined;
  }

  const options = enabledOptions(build);
  const models = [build.models.fast, build.models.reasoning].filter((m): m is string => Boolean(m));

  const download = async () => {
    if (!sessionId || downloading) return;
    setDownloading(true);
    setProblem(null);
    const result = await downloadBuildZip(BUILDER_AGENT, sessionId, build);
    setDownloading(false);
    if (result !== 'ok') setProblem(DOWNLOAD_PROBLEMS[result]);
  };

  return (
    <>
      <Card variant="filled" className="p-5" role="group" aria-label={`Build: ${build.name}`}>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--md-shape-md)] bg-md-primary-container text-md-on-primary-container">
            <Package className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-label-medium uppercase tracking-wider text-md-on-surface-variant">Your agent</p>
            <h3 className="text-title-medium text-md-on-surface">{build.name}</h3>
            {build.description ? (
              <p className="mt-1 line-clamp-3 text-body-medium text-md-on-surface-variant">{build.description}</p>
            ) : null}
            {options.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <Chip key={o} variant="category">
                    {o}
                  </Chip>
                ))}
              </div>
            ) : null}
            {models.length > 0 ? (
              <p className="mt-3 break-all text-label-medium text-md-on-surface-variant">Models: {models.join(' · ')}</p>
            ) : null}
            <p className="mt-1 text-label-medium text-md-on-surface-variant">
              {plural(build.files, 'file')} · {plural(build.tools.length, 'tool')} · {plural(build.skills.length, 'skill')} ·{' '}
              {formatBytes(build.bytes)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col items-start gap-2">
          <Button size="sm" variant="tonal" onClick={download} disabled={!sessionId || downloading}>
            <Download /> {downloading ? 'Downloading…' : 'Download zip'}
          </Button>
          {problem ? (
            <p role="alert" className="text-body-medium text-md-error">
              {problem}
            </p>
          ) : null}
          <Button size="sm" variant="filled" onClick={() => setEmailOpen(true)} disabled={!sessionId}>
            <Mail /> Email me a permanent link
          </Button>
        </div>
      </Card>

      <EmailBuildDialog open={emailOpen} onOpenChange={setEmailOpen} build={build} sessionId={sessionId} />
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (Behaviour is covered by the Task 9 e2e: dialog body, "Check your inbox", booking link, dev-mode link.)

- [ ] **Step 4: Commit**

```bash
git add adk-web-ui/components/build
git commit -m "feat(builds): email-me-a-permanent-link dialog under the build card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `/builds/[token]` page, zip download and delete

**Files:**
- Create: `adk-web-ui/lib/build/link-handlers.ts`, test `adk-web-ui/lib/build/link-handlers.test.ts`
- Create: `adk-web-ui/app/api/builds/[token]/route.ts`
- Create: `adk-web-ui/app/api/builds/[token]/zip/route.ts`
- Create: `adk-web-ui/app/builds/[token]/page.tsx`
- Create: `adk-web-ui/components/build/BuildLinkActions.tsx`
- Modify: `adk-web-ui/next.config.ts:86-88`
- Modify: `adk-web-ui/lib/analytics/should-track.ts:1-8`, test `adk-web-ui/lib/analytics/should-track.test.ts`

**Interfaces:**
- Consumes: Task 1 (`parseBuild`, `enabledOptions`, `formatBytes`, `plural`, `runSteps`, `zipFileName`), Task 3 (`findBuildSave`, `buildLinkStore`), Task 4 (`isBuildToken`, `hashBuildToken`, `newBuildToken`).
- Produces: `type BuildLinkStore = { takeZip(hash): Promise<{ zip: Buffer; projectName: string } | null>; wipe(hash): Promise<boolean> }`, `handleZipDownload(token, store)`, `handleBuildDelete(token, store)`; routes `GET /api/builds/[token]/zip`, `DELETE /api/builds/[token]`; page `/builds/[token]` with buttons "Download zip", "Delete this build", "Yes, delete it" and deleted-state heading "Build deleted" (used by Task 9 e2e).

- [ ] **Step 1: Write the failing tests**

`adk-web-ui/lib/build/link-handlers.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleBuildDelete, handleZipDownload, type BuildLinkStore } from './link-handlers.ts';
import { hashBuildToken, newBuildToken } from './token.ts';

type Row = { zip: Buffer | null; email: string | null; projectName: string; deletedAt: Date | null; downloads: number };

/** Same semantics as db-store's takeBuildZip / wipeBuildSave. */
function memoryStore() {
  const rows = new Map<string, Row>();
  let calls = 0;
  const store: BuildLinkStore = {
    async takeZip(hash) {
      calls++;
      const r = rows.get(hash);
      if (!r || r.deletedAt || !r.zip) return null;
      r.downloads++;
      return { zip: r.zip, projectName: r.projectName };
    },
    async wipe(hash) {
      calls++;
      const r = rows.get(hash);
      if (!r || r.deletedAt) return false;
      Object.assign(r, { zip: null, email: null, deletedAt: new Date() });
      return true;
    },
  };
  return { rows, store, calls: () => calls };
}

const ZIP = Buffer.from([0x50, 0x4b, 5, 6]);

function seeded() {
  const m = memoryStore();
  const { token, hash } = newBuildToken();
  m.rows.set(hash, { zip: ZIP, email: 'delivered@resend.dev', projectName: 'research-summarizer', deletedAt: null, downloads: 0 });
  return { ...m, token, hash };
}

describe('build link handlers', () => {
  it('404s an unknown token, and a malformed one without a lookup', async () => {
    const m = memoryStore();
    assert.deepEqual(await handleZipDownload(newBuildToken().token, m.store), { status: 404 });
    assert.deepEqual(await handleBuildDelete(newBuildToken().token, m.store), { status: 404 });
    const before = m.calls();
    assert.deepEqual(await handleZipDownload('../etc/passwd', m.store), { status: 404 });
    assert.deepEqual(await handleBuildDelete(undefined, m.store), { status: 404 });
    assert.equal(m.calls(), before);
  });

  it('downloads the stored zip under the project name and counts it', async () => {
    const s = seeded();
    const out = await handleZipDownload(s.token, s.store);
    assert.equal(out.status, 200);
    assert.ok(out.status === 200 && out.body.equals(ZIP));
    assert.equal(out.status === 200 ? out.fileName : null, 'research-summarizer.zip');
    assert.equal(s.rows.get(s.hash)?.downloads, 1);
    assert.equal(hashBuildToken(s.token), s.hash);
  });

  it('delete wipes the zip and email; downloads then 404', async () => {
    const s = seeded();
    assert.deepEqual(await handleBuildDelete(s.token, s.store), { status: 200 });
    const row = s.rows.get(s.hash);
    assert.equal(row?.zip, null);
    assert.equal(row?.email, null);
    assert.ok(row?.deletedAt);
    assert.deepEqual(await handleZipDownload(s.token, s.store), { status: 404 });
    assert.deepEqual(await handleBuildDelete(s.token, s.store), { status: 404 });
  });
});
```

Append to `adk-web-ui/lib/analytics/should-track.test.ts` inside `describe('shouldTrackPath', ...)`:

```ts
  it('never records build links (their path is a secret)', () => {
    assert.equal(shouldTrackPath('/builds/' + 'a'.repeat(43)), false);
    assert.equal(shouldTrackPath('/builds'), true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test lib/build/link-handlers.test.ts lib/analytics/should-track.test.ts`
Expected: FAIL — `link-handlers.ts` not found; `/builds/<token>` is tracked.

- [ ] **Step 3: Implement the handlers and the tracking skip**

`adk-web-ui/lib/build/link-handlers.ts`:

```ts
import { zipFileName } from './summary';
import { hashBuildToken, isBuildToken } from './token';

export type BuildLinkStore = {
  takeZip(tokenHash: string): Promise<{ zip: Buffer; projectName: string } | null>;
  wipe(tokenHash: string): Promise<boolean>;
};

export type ZipDownload = { status: 404 } | { status: 200; body: Buffer; fileName: string };

/** Unknown, malformed and deleted tokens are all the same 404. */
export async function handleZipDownload(token: unknown, store: BuildLinkStore): Promise<ZipDownload> {
  if (!isBuildToken(token)) return { status: 404 };
  const row = await store.takeZip(hashBuildToken(token));
  return row ? { status: 200, body: row.zip, fileName: zipFileName(row.projectName) } : { status: 404 };
}

/** "Delete this build": wipes the zip and the email. */
export async function handleBuildDelete(token: unknown, store: BuildLinkStore): Promise<{ status: 200 | 404 }> {
  if (!isBuildToken(token)) return { status: 404 };
  return { status: (await store.wipe(hashBuildToken(token))) ? 200 : 404 };
}
```

In `adk-web-ui/lib/analytics/should-track.ts`, add `'/builds/',` to `SKIP_PREFIXES` (after `'/api/',`) with a comment line above it:

```ts
  // Build links carry a secret token in the path.
  '/builds/',
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test lib/build/link-handlers.test.ts lib/analytics/should-track.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the routes**

`adk-web-ui/app/api/builds/[token]/zip/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { isDbEnabled } from '@/lib/db';
import { buildLinkStore } from '@/lib/build/db-store';
import { handleZipDownload } from '@/lib/build/link-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = newRequestId();
  const { token } = await params;
  if (!isDbEnabled()) return apiError('not_found', requestId);
  try {
    const out = await handleZipDownload(token, buildLinkStore);
    if (out.status === 404) return apiError('not_found', requestId);
    return new NextResponse(new Uint8Array(out.body), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${out.fileName}"`,
        'Content-Length': String(out.body.length),
        'Cache-Control': 'private, no-store',
        'x-request-id': requestId,
      },
    });
  } catch (error) {
    return apiError('internal', requestId, { log: error instanceof Error ? error.name : 'unknown' });
  }
}
```

`adk-web-ui/app/api/builds/[token]/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { newRequestId } from '@/lib/api-error';
import { apiError } from '@/lib/api-response';
import { isDbEnabled } from '@/lib/db';
import { rejectCrossOrigin } from '@/lib/origin-guard';
import { buildLinkStore } from '@/lib/build/db-store';
import { handleBuildDelete } from '@/lib/build/link-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Self-service deletion promised by /privacy: wipes the zip and the email. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const requestId = newRequestId();
  const crossOrigin = rejectCrossOrigin(request, requestId);
  if (crossOrigin) return crossOrigin;
  const { token } = await params;
  if (!isDbEnabled()) return apiError('not_found', requestId);
  try {
    const out = await handleBuildDelete(token, buildLinkStore);
    if (out.status === 404) return apiError('not_found', requestId);
    return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return apiError('internal', requestId, { log: error instanceof Error ? error.name : 'unknown' });
  }
}
```

- [ ] **Step 6: Add the page and its actions**

`adk-web-ui/components/build/BuildLinkActions.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

export default function BuildLinkActions({ token, fileName }: { token: string; fileName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle');

  const remove = async () => {
    setStatus('deleting');
    try {
      const res = await fetch(`/api/builds/${encodeURIComponent(token)}`, { method: 'DELETE' });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      router.refresh();
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <a href={`/api/builds/${encodeURIComponent(token)}/zip`} download={fileName} className={buttonVariants({ variant: 'filled' })}>
        <Download /> Download zip
      </a>
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <Button variant="outlined" onClick={remove} disabled={status === 'deleting'}>
              {status === 'deleting' ? 'Deleting…' : 'Yes, delete it'}
            </Button>
            <Button variant="text" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="text" onClick={() => setConfirming(true)}>
            <Trash2 /> Delete this build
          </Button>
        )}
      </div>
      {confirming ? (
        <p className="text-body-medium text-md-on-surface-variant">
          This removes the zip and your email address. The link will stop working.
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className="text-body-medium text-md-error">
          Could not delete the build. Try again in a moment.
        </p>
      ) : null}
    </div>
  );
}
```

`adk-web-ui/app/builds/[token]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isDbEnabled } from '@/lib/db';
import { findBuildSave } from '@/lib/build/db-store';
import { parseBuild } from '@/lib/build/parse';
import { enabledOptions, formatBytes, plural, runSteps, zipFileName } from '@/lib/build/summary';
import { hashBuildToken, isBuildToken } from '@/lib/build/token';
import { cn } from '@/lib/utils';
import { Page, PageHeader } from '@/components/layout/Page';
import { panelClass } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import BuildLinkActions from '@/components/build/BuildLinkActions';

export const dynamic = 'force-dynamic';

// The token is a secret: keep the page out of search engines and referrers
// (next.config.ts also sends X-Robots-Tag and Referrer-Policy headers).
export const metadata: Metadata = {
  title: 'Your build | ADK Agent Directory',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Params = Promise<{ token: string }>;

export default async function BuildLinkPage({ params }: { params: Params }) {
  const { token } = await params;
  // Malformed, unknown and unconfigured all look the same: a plain 404.
  if (!isBuildToken(token) || !isDbEnabled()) notFound();
  const save = await findBuildSave(hashBuildToken(token));
  if (!save) notFound();

  if (save.deletedAt) {
    return (
      <Page>
        <PageHeader
          title="Build deleted"
          description="This build, its zip and the email address it was sent to have been deleted. The link no longer works."
        />
      </Page>
    );
  }

  const build = parseBuild(save.build);
  const fileName = zipFileName(save.projectName);
  const options = build ? enabledOptions(build) : [];
  const models = build ? [build.models.fast, build.models.reasoning].filter((m): m is string => Boolean(m)) : [];

  return (
    <Page>
      <PageHeader title={build?.name ?? save.projectName} description={build?.description || 'An agent you built with the agent builder.'} />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className={cn(panelClass, 'space-y-6 p-6')}>
          <div className="space-y-3">
            <h2 className="text-title-medium text-md-on-surface">What&apos;s in it</h2>
            {options.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <Chip key={o} variant="category">
                    {o}
                  </Chip>
                ))}
              </div>
            ) : null}
            {models.length > 0 ? (
              <p className="break-all text-body-medium text-md-on-surface-variant">Models: {models.join(' · ')}</p>
            ) : null}
            {build ? (
              <p className="text-body-medium text-md-on-surface-variant">
                {plural(build.files, 'file')} · {plural(build.tools.length, 'tool')} · {plural(build.skills.length, 'skill')} ·{' '}
                {formatBytes(save.zipBytes)}
              </p>
            ) : (
              <p className="text-body-medium text-md-on-surface-variant">{formatBytes(save.zipBytes)}</p>
            )}
          </div>
          <div className="space-y-3">
            <h2 className="text-title-medium text-md-on-surface">Run it locally</h2>
            <ol className="list-decimal space-y-1 pl-5 text-body-medium text-md-on-surface-variant">
              {runSteps(fileName).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </section>
        <aside className={cn(panelClass, 'p-6')}>
          <BuildLinkActions token={token} fileName={fileName} />
        </aside>
      </div>
    </Page>
  );
}
```

- [ ] **Step 7: Send `noindex` and `no-referrer` headers for build links**

In `adk-web-ui/next.config.ts`, add after the `securityHeaders` array:

```ts
// Build links carry a secret token: keep them out of referrers and search engines.
const privateLinkHeaders = [
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];
```

and replace

```ts
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
```

with

```ts
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Later entries override the same header key from earlier ones.
      { source: '/builds/:path*', headers: privateLinkHeaders },
      { source: '/api/builds/:path*', headers: privateLinkHeaders },
    ];
  },
```

- [ ] **Step 8: Verify**

Run: `npm run test:unit && npx tsc --noEmit && npm run lint`
Expected: PASS / clean.

Manual (dev mode, after Task 5's manual check produced a `link`): open the link → the page shows the build; "Download zip" downloads `research-summarizer.zip` (or the built project's name); "Delete this build" → "Yes, delete it" → the page shows "Build deleted"; `curl -I <base>/api/builds/<token>/zip` → `404`. `curl -I <base>/builds/not-a-token` → `404` with `x-robots-tag: noindex, nofollow` and `referrer-policy: no-referrer`.

- [ ] **Step 9: Commit**

```bash
git add adk-web-ui/lib/build/link-handlers.ts adk-web-ui/lib/build/link-handlers.test.ts adk-web-ui/app/api/builds adk-web-ui/app/builds adk-web-ui/components/build/BuildLinkActions.tsx adk-web-ui/next.config.ts adk-web-ui/lib/analytics/should-track.ts adk-web-ui/lib/analytics/should-track.test.ts
git commit -m "feat(builds): private /builds/<token> page with zip download and delete

Unknown tokens are a plain 404; pages and API send noindex and
no-referrer, and build paths are never recorded as pageviews.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Ops analytics: zips, emailed builds and help requests

**Files:**
- Modify: `adk-web-ui/lib/analytics/conversation-insights.ts`, test `adk-web-ui/lib/analytics/conversation-insights.test.ts`
- Modify: `adk-web-ui/lib/analytics/adk-events.ts`
- Modify: `adk-web-ui/lib/analytics/ops-insights.ts`, `adk-web-ui/lib/analytics/ops-types.ts`
- Modify: `adk-web-ui/components/analytics/ops/ConversationsView.tsx`, `adk-web-ui/components/analytics/ops/InsightsView.tsx`

**Interfaces:**
- Consumes: Task 1 `optionLabel`; Task 3 `build_saves` columns `session_id`, `email_sent_at`, `updates_consent_at`, `help_requested` (metadata only, never `zip`).
- Produces:
  - `ConversationRow` loses `hasBlueprint`/`saved`, gains `hasBuild: boolean; emailed: boolean; helpRequested: boolean`.
  - `ConversationOutcome = 'emailed' | 'zip' | 'error' | 'one-and-done' | 'engaged' | 'short'`.
  - `builderFunnel` step ids `started`, `continued`, `zip`, `emailed`, `help`.
  - `type BuildRecord`, `type BuildSummary`, `type BuildInsights`, `buildInsights(records, recentLimit?)` replace the blueprint equivalents; `buildHighlights` no longer takes `blueprints`.
  - `fetchBuilderBuilds(range): Promise<BuildRecord[]>` replaces `fetchBuilderBlueprints`; `OpsInsights.builds` replaces `.blueprints`.

- [ ] **Step 1: Update the tests first**

In `adk-web-ui/lib/analytics/conversation-insights.test.ts`:

1. In the import list replace `blueprintArchitecture,` and `blueprintInsights,` with `buildInsights,`.
2. In `conv()`, replace `hasBlueprint: false,\n    saved: false,` with:

```ts
    hasBuild: false,
    emailed: false,
    helpRequested: false,
```

3. Replace the whole `describe('conversationOutcome', ...)` block with:

```ts
describe('conversationOutcome', () => {
  it('ranks emailed over zip over error over turn counts', () => {
    assert.equal(conversationOutcome({ emailed: true, hasBuild: true, errors: 1, userTurns: 1 }), 'emailed');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: true, errors: 1, userTurns: 1 }), 'zip');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: false, errors: 2, userTurns: 5 }), 'error');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: false, errors: 0, userTurns: 1 }), 'one-and-done');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: false, errors: 0, userTurns: 2 }), 'short');
    assert.equal(conversationOutcome({ emailed: false, hasBuild: false, errors: 0, userTurns: 3 }), 'engaged');
  });
});
```

4. Replace the whole `describe('builderFunnel', ...)` block with:

```ts
describe('builderFunnel', () => {
  it('counts only builder conversations: started, continued, zip, emailed, help', () => {
    const rows = [
      conv({ appName: BUILDER_APP, userTurns: 1 }),
      conv({ appName: BUILDER_APP, userTurns: 3 }),
      conv({ appName: BUILDER_APP, userTurns: 4, hasBuild: true }),
      conv({ appName: BUILDER_APP, userTurns: 5, hasBuild: true, emailed: true, helpRequested: true }),
      conv({ appName: 'other', userTurns: 9, hasBuild: true, emailed: true }),
    ];
    const f = builderFunnel(rows);
    assert.deepEqual(f.map((s) => s.id), ['started', 'continued', 'zip', 'emailed', 'help']);
    assert.deepEqual(f.map((s) => s.label), ['Started a design', 'Answered a follow-up', 'Got a zip', 'Emailed it', 'Asked for help']);
    assert.deepEqual(f.map((s) => s.count), [4, 3, 2, 1, 1]);
    assert.deepEqual(f.map((s) => s.ofFirst), [100, 75, 50, 25, 25]);
    assert.equal(f[2].ofPrevious, 66.7);
    assert.equal(f[3].ofPrevious, 50);
    assert.equal(f[4].ofPrevious, 100);
  });
});
```

5. Replace the whole `describe('blueprints', ...)` block with:

```ts
describe('buildInsights', () => {
  const record = (over: object) => ({ sessionId: 's', userId: 'a_1', updatedAt: '', emailed: false, updates: false, help: false, build: {}, ...over });

  it('counts emails, opt-ins, options, models and tools, newest first', () => {
    const b = buildInsights([
      record({
        sessionId: 's1',
        updatedAt: '2026-10-01T00:00:00Z',
        emailed: true,
        updates: true,
        build: {
          name: 'one',
          options: { with_slack: true, with_eval: false },
          models: { fast: 'm1', reasoning: 'm2' },
          tools: ['Web_Search', 'web_search'],
          skills: ['x'],
          files: 10,
        },
      }),
      record({
        sessionId: 's2',
        updatedAt: '2026-10-02T00:00:00Z',
        help: true,
        build: { name: 'two', options: { with_slack: true, persona: true }, models: { fast: 'm1', reasoning: null }, tools: ['gmail'], files: 5 },
      }),
    ]);
    assert.deepEqual([b.total, b.emailed, b.updates, b.help], [2, 1, 1, 1]);
    assert.deepEqual(b.options.map((o) => [o.label, o.count, o.share]), [['Slack', 2, 100], ['Persona', 1, 50]]);
    assert.deepEqual(b.models.map((m) => [m.label, m.count]), [['m1', 2], ['m2', 1]]);
    assert.deepEqual(b.tools.map((t) => [t.label, t.count, t.share]), [['gmail', 1, 50], ['Web_Search', 1, 50]]);
    assert.deepEqual(b.recent.map((r) => r.sessionId), ['s2', 's1']);
    assert.deepEqual(b.recent[0].options, ['Persona', 'Slack']);
    assert.equal(b.recent[1].tools, 1);
    assert.equal(b.recent[1].files, 10);
  });

  it('survives malformed builds', () => {
    const b = buildInsights([record({ build: { options: 'x', tools: 3, models: [] } })]);
    assert.equal(b.total, 1);
    assert.equal(b.recent[0].name, 'Untitled build');
    assert.deepEqual(b.options, []);
  });
});
```

6. In `describe('buildHighlights', ...)`, replace the `builderRows` definition's builder lines with:

```ts
    ...Array.from({ length: 20 }, () => conv({ appName: BUILDER_APP, userTurns: 1 })),
    ...Array.from({ length: 20 }, () => conv({ appName: BUILDER_APP, userTurns: 3, hasBuild: true })),
    ...Array.from({ length: 2 }, () => conv({ appName: BUILDER_APP, userTurns: 3, hasBuild: true, emailed: true })),
```

remove the line `blueprints: blueprintInsights([]),` from `input`, and in `it('names the weakest funnel step, ...')` replace `assert.match(leak.title, /blueprints get saved/);` with:

```ts
    assert.match(leak.title, /zips get emailed/);
    assert.match(leak.detail, /emailed build/);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test lib/analytics/conversation-insights.test.ts`
Expected: FAIL — `buildInsights` is not exported; outcome/funnel ids differ.

- [ ] **Step 3: Update `conversation-insights.ts`**

In `adk-web-ui/lib/analytics/conversation-insights.ts`:

1. Add after the file's doc comment: `import { optionLabel } from '../build/summary';`
2. In `ConversationRow`, replace `hasBlueprint: boolean;\n  saved: boolean;` with:

```ts
  /** The session state holds a packaged build (`builder:build`). */
  hasBuild: boolean;
  /** A build from this session was emailed (build_saves.email_sent_at set). */
  emailed: boolean;
  /** The visitor ticked "I'd like help deploying it". */
  helpRequested: boolean;
```

3. Replace the `ConversationOutcome` type, `OUTCOME_LABELS` and `conversationOutcome` with:

```ts
export type ConversationOutcome = 'emailed' | 'zip' | 'error' | 'one-and-done' | 'engaged' | 'short';

export const OUTCOME_LABELS: Record<ConversationOutcome, string> = {
  emailed: 'Emailed build',
  zip: 'Got a zip',
  error: 'Error',
  'one-and-done': 'Single message',
  engaged: 'Engaged',
  short: 'Short',
};

/** The single most important thing that happened, best outcome first. */
export function conversationOutcome(c: Pick<ConversationRow, 'emailed' | 'hasBuild' | 'errors' | 'userTurns'>): ConversationOutcome {
  if (c.emailed) return 'emailed';
  if (c.hasBuild) return 'zip';
  if (c.errors > 0) return 'error';
  if (c.userTurns <= 1) return 'one-and-done';
  if (c.userTurns >= 3) return 'engaged';
  return 'short';
}
```

4. Replace `builderFunnel` (doc comment included) with:

```ts
/** Builder conversations → kept going → got a zip → emailed it → asked for help. */
export function builderFunnel(rows: readonly ConversationRow[]): FunnelStep[] {
  const builder = rows.filter((c) => c.appName === BUILDER_APP);
  const steps = [
    { id: 'started', label: 'Started a design', count: builder.length },
    { id: 'continued', label: 'Answered a follow-up', count: builder.filter((c) => c.userTurns >= 2).length },
    { id: 'zip', label: 'Got a zip', count: builder.filter((c) => c.hasBuild).length },
    { id: 'emailed', label: 'Emailed it', count: builder.filter((c) => c.emailed).length },
    { id: 'help', label: 'Asked for help', count: builder.filter((c) => c.helpRequested).length },
  ];
  return steps.map((step, i) => ({
    ...step,
    ofFirst: rate(step.count, steps[0].count),
    ofPrevious: i === 0 ? 100 : rate(step.count, steps[i - 1].count),
  }));
}
```

5. Replace everything from the `// Blueprints` section banner up to (not including) the `// Highlights` section banner with:

```ts
// ---------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------

/** One builder session with a packaged build, plus what its build_saves rows say. */
export type BuildRecord = {
  sessionId: string;
  userId: string;
  updatedAt: string;
  emailed: boolean;
  updates: boolean;
  help: boolean;
  /** `state["builder:build"]`, unvalidated. */
  build: unknown;
};

type RawBuild = {
  name?: unknown;
  description?: unknown;
  options?: unknown;
  models?: unknown;
  tools?: unknown;
  skills?: unknown;
  files?: unknown;
};

export type BuildSummary = {
  sessionId: string;
  name: string;
  description: string;
  options: string[];
  tools: number;
  skills: number;
  files: number;
  emailed: boolean;
  help: boolean;
  updatedAt: string;
};

export type BuildInsights = {
  total: number;
  emailed: number;
  updates: number;
  help: number;
  options: ShareRow[];
  models: ShareRow[];
  tools: ShareRow[];
  recent: BuildSummary[];
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

export function buildInsights(records: readonly BuildRecord[], recentLimit = 12): BuildInsights {
  const options = new Map<string, number>();
  const optionLabels: Record<string, string> = {};
  const models = new Map<string, number>();
  const tools = new Map<string, number>();
  const toolLabels: Record<string, string> = {};
  let emailed = 0;
  let updates = 0;
  let help = 0;
  const summaries: BuildSummary[] = [];

  for (const r of records) {
    const b = record(r.build) as RawBuild;
    if (r.emailed) emailed++;
    if (r.updates) updates++;
    if (r.help) help++;

    const on = Object.entries(record(b.options))
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    for (const key of on) {
      options.set(key, (options.get(key) ?? 0) + 1);
      optionLabels[key] ??= optionLabel(key);
    }

    const m = record(b.models);
    for (const model of new Set([str(m.fast), str(m.reasoning)].filter(Boolean))) {
      models.set(model, (models.get(model) ?? 0) + 1);
    }

    // Each build counts a tool once, whatever its casing.
    const names = new Set<string>();
    for (const label of strings(b.tools)) {
      const id = label.toLowerCase();
      names.add(id);
      toolLabels[id] ??= label;
    }
    for (const id of names) tools.set(id, (tools.get(id) ?? 0) + 1);

    summaries.push({
      sessionId: r.sessionId,
      name: str(b.name) || 'Untitled build',
      description: str(b.description),
      options: on.map((k) => optionLabels[k]).sort(),
      tools: names.size,
      skills: strings(b.skills).length,
      files: typeof b.files === 'number' && b.files >= 0 ? b.files : 0,
      emailed: r.emailed,
      help: r.help,
      updatedAt: r.updatedAt,
    });
  }

  const total = records.length;
  const modelLabels = Object.fromEntries([...models.keys()].map((m) => [m, m]));
  return {
    total,
    emailed,
    updates,
    help,
    options: rankByShareOf(options, total, optionLabels, 10),
    models: rankByShareOf(models, total, modelLabels, 6),
    tools: rankByShareOf(tools, total, toolLabels, 12),
    recent: summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, recentLimit),
  };
}
```

6. In `buildHighlights`:
- In the input type, remove the line `blueprints: BlueprintInsights;`, and change `const { overview, funnel, agents, demand, blueprints } = input;` to `const { overview, funnel, agents, demand } = input;`.
- Replace the funnel-leak block (from `// The weakest step of the builder funnel` through its closing `}`) with:

```ts
  // The weakest step of the builder funnel, judged on a real sample. Asking
  // for help is optional, so it is not a leak.
  const leaks = funnel.slice(1).filter((s, i) => s.id !== 'help' && funnel[i].count >= MIN_SAMPLE);
  const leak = [...leaks].sort((a, b) => a.ofPrevious - b.ofPrevious)[0];
  if (leak) {
    const sentence: Record<string, string> = {
      continued: `${pctText(100 - leak.ofPrevious)} of builder conversations stop after the first reply`,
      zip: `Only ${pctText(leak.ofPrevious)} of builder conversations that continue get a zip`,
      emailed: `Only ${pctText(leak.ofPrevious)} of zips get emailed`,
    };
    const emailedStep = funnel.find((s) => s.id === 'emailed') ?? funnel[funnel.length - 1];
    out.push({
      id: 'funnel-leak',
      tone: 'risk',
      title: sentence[leak.id] ?? `${leak.label}: ${pctText(leak.ofPrevious)} of the step before`,
      detail: `Biggest drop in the builder funnel. ${pctText(emailedStep.ofFirst)} of started designs end with an emailed build.`,
    });
  }
```

- Delete the MCP block (from `const mcp = blueprints.toolKinds.find(...)` through its closing `}`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test lib/analytics/conversation-insights.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the queries**

In `adk-web-ui/lib/analytics/adk-events.ts`:

1. In the import from `./conversation-insights`, replace `type BlueprintRecord,` with `type BuildRecord,`.
2. Replace `let submissionsCache` with `let buildSavesCache: { value: boolean; at: number } | null = null;` and replace `hasSubmissionsTable` with:

```ts
async function hasBuildSavesTable(): Promise<boolean> {
  if (buildSavesCache && Date.now() - buildSavesCache.at < SCHEMA_TTL_MS) return buildSavesCache.value;
  const rows = unwrapExecuteRows<{ exists: boolean }>(
    await db.execute(sql`SELECT to_regclass('build_saves') IS NOT NULL AS exists`)
  );
  const value = Boolean(rows[0]?.exists);
  buildSavesCache = { value, at: Date.now() };
  return value;
}
```

3. In `ConversationSqlRow`, replace `has_blueprint: boolean | null;\n  saved: boolean | null;` with:

```ts
  has_build: boolean | null;
  emailed: boolean | null;
  help_requested: boolean | null;
```

4. In `fetchConversations`: change the doc comment's last line to "and whether the builder packaged a build, and whether it was emailed or help was asked for." Replace

```ts
  const saved = (await hasSubmissionsTable())
    ? sql`EXISTS (SELECT 1 FROM blueprint_submissions b WHERE b.session_id = c.session_id)`
    : sql`false`;
```

with

```ts
  // build_saves metadata only (never the zip).
  const saves = await hasBuildSavesTable();
  const emailed = saves
    ? sql`EXISTS (SELECT 1 FROM build_saves b WHERE b.session_id = c.session_id AND b.email_sent_at IS NOT NULL)`
    : sql`false`;
  const helpRequested = saves
    ? sql`EXISTS (SELECT 1 FROM build_saves b WHERE b.session_id = c.session_id AND b.help_requested)`
    : sql`false`;
```

and in the final `SELECT` replace

```sql
        (s.state::jsonb ? 'blueprint:document') AS has_blueprint,
        ${saved} AS saved
```

with

```sql
        COALESCE(s.state::jsonb ? 'builder:build', false) AS has_build,
        ${emailed} AS emailed,
        ${helpRequested} AS help_requested
```

and in the row mapping replace `hasBlueprint: Boolean(r.has_blueprint),\n    saved: Boolean(r.saved),` with:

```ts
    hasBuild: Boolean(r.has_build),
    emailed: Boolean(r.emailed),
    helpRequested: Boolean(r.help_requested),
```

5. Replace `fetchBuilderBlueprints` (doc comment included) with:

```ts
/** Builder sessions whose state holds a packaged build, updated in the range. */
export async function fetchBuilderBuilds(range: TimelineRange): Promise<BuildRecord[]> {
  const schema = await detectAdkEventsSchema();
  if (!schema) return [];
  const saves = (await hasBuildSavesTable())
    ? sql`LEFT JOIN LATERAL (
        SELECT bool_or(b.email_sent_at IS NOT NULL) AS emailed,
          bool_or(b.updates_consent_at IS NOT NULL) AS updates,
          bool_or(b.help_requested) AS help
        FROM build_saves b WHERE b.session_id = s.id
      ) bs ON true`
    : sql`LEFT JOIN LATERAL (SELECT false AS emailed, false AS updates, false AS help) bs ON true`;
  const rows = unwrapExecuteRows<{
    id: string;
    user_id: string;
    update_time: unknown;
    emailed: boolean | null;
    updates: boolean | null;
    help: boolean | null;
    build: unknown;
  }>(
    await db.execute(sql`
      SELECT s.id, s.user_id, s.update_time, s.state::jsonb->'builder:build' AS build,
        bs.emailed, bs.updates, bs.help
      FROM sessions s
      ${saves}
      WHERE s.app_name = ${BUILDER_APP} AND s.state::jsonb ? 'builder:build'
        ${sinceFilter(sql`s.update_time`, range)}
      ORDER BY s.update_time DESC
      LIMIT 1000
    `)
  );
  return rows.map((r) => ({
    sessionId: String(r.id),
    userId: String(r.user_id),
    updatedAt: iso(r.update_time),
    emailed: Boolean(r.emailed),
    updates: Boolean(r.updates),
    help: Boolean(r.help),
    build: typeof r.build === 'string' ? safeJson(r.build) : r.build,
  }));
}
```

In `adk-web-ui/lib/analytics/ops-types.ts`, replace `BlueprintInsights,` in the import with `BuildInsights,`, and in `OpsInsights` replace `blueprints: BlueprintInsights;` with `builds: BuildInsights;`.

In `adk-web-ui/lib/analytics/ops-insights.ts`:
- Import: `import { fetchBuilderBuilds, fetchConversations, fetchToolUsage } from './adk-events';` and replace `blueprintInsights,` with `buildInsights,` in the `./conversation-insights` import.
- Replace the body lines:

```ts
  const [rows, builds, tools] = await Promise.all([
    fetchConversations(range),
    fetchBuilderBuilds(range),
    fetchToolUsage(range),
  ]);
```

```ts
  const buildStats = buildInsights(builds);
```

```ts
    available: rows.length > 0 || builds.length > 0,
    highlights: buildHighlights({ overview, funnel, agents, demand, nameOf }),
```

```ts
    builds: buildStats,
```

(replacing the `blueprints` destructuring, `blueprintStats`, the `available`/`highlights` lines and `blueprints: blueprintStats,` respectively).

- [ ] **Step 6: Update the views**

In `adk-web-ui/components/analytics/ops/ConversationsView.tsx` replace the two filter lines

```ts
  { id: 'saved', label: OUTCOME_LABELS.saved },
  { id: 'blueprint', label: OUTCOME_LABELS.blueprint },
```

with

```ts
  { id: 'emailed', label: OUTCOME_LABELS.emailed },
  { id: 'zip', label: OUTCOME_LABELS.zip },
```

and in `OutcomeBadge` replace `outcome === 'saved' || outcome === 'blueprint'` with `outcome === 'emailed' || outcome === 'zip'`.

In `adk-web-ui/components/analytics/ops/InsightsView.tsx`:
- Replace `const b = data.blueprints;` with `const b = data.builds;`.
- Replace the funnel panel subtitle `"Builder conversations, from first message to a saved blueprint"` with `"Builder conversations, from first message to an emailed build"`.
- Replace everything from the `<div className="grid gap-4 lg:grid-cols-3">` that contains "Integrations mentioned" through the closing `</div>` of the grid that contains "Models in blueprints" with:

```tsx
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Integrations mentioned" subtitle="Share of typed conversations naming the product">
          <RankedBars rows={shareRows(d.integrations).slice(0, 8)} color={BAR} empty="No integrations mentioned." />
        </Panel>
        <Panel
          title="What they build"
          subtitle={`${formatCount(b.total)} builds · ${formatCount(b.emailed)} emailed · ${formatCount(b.help)} asked for help`}
        >
          <RankedBars rows={shareRows(b.options)} color={BAR} empty="No nuvel options used in this range." />
        </Panel>
        <Panel title="Models in builds" subtitle="Share of builds using each model">
          <RankedBars rows={shareRows(b.models)} color={BAR} empty="No builds in this range." />
        </Panel>
      </div>

      <Panel
        title="Latest builds"
        subtitle={`${formatCount(b.emailed)} of ${formatCount(b.total)} emailed · ${formatCount(b.updates)} opted in to updates`}
      >
        {b.recent.length === 0 ? (
          <p className="text-body-medium text-md-on-surface-variant">No builds in this range.</p>
        ) : (
          <ul className="divide-y divide-md-outline/60 dark:divide-md-outline-variant">
            {b.recent.map((build) => (
              <li key={build.sessionId}>
                <button
                  type="button"
                  onClick={() => onOpenConversation('adk_agent_builder', build.sessionId)}
                  className="-mx-2 flex w-[calc(100%+1rem)] flex-col gap-1 rounded-[var(--md-shape-sm)] px-2 py-3 text-left transition-colors hover:bg-md-on-surface/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary sm:flex-row sm:items-start sm:gap-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-title-small text-md-on-surface">{build.name}</span>
                      {build.emailed ? (
                        <span className="shrink-0 rounded-full bg-md-primary-container px-2 py-0.5 text-label-medium text-md-on-primary-container">
                          Emailed
                        </span>
                      ) : null}
                      {build.help ? (
                        <span className="shrink-0 rounded-full bg-md-secondary-container px-2 py-0.5 text-label-medium text-md-on-secondary-container">
                          Help
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-body-medium text-md-on-surface-variant">{build.description}</span>
                  </span>
                  <span className="shrink-0 text-label-medium text-md-on-surface-variant sm:w-64 sm:text-right">
                    {build.files} files · {build.tools} tools · {build.skills} skills
                    {build.options.length > 0 ? <span className="block truncate">{build.options.join(', ')}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top build tools" subtitle="Tool modules in packaged builds">
          <RankedBars rows={shareRows(b.tools).slice(0, 8)} color={BAR} empty="No tools in builds." />
        </Panel>
        <Panel title="Languages" subtitle="Of typed first messages">
          <RankedBars rows={shareRows(d.languages)} color={BAR} empty="No typed first messages." />
        </Panel>
      </div>
```

- [ ] **Step 7: Verify**

Run: `grep -rn -i "blueprint" adk-web-ui/lib/analytics adk-web-ui/components/analytics`
Expected: no output.

Run: `npm run test:unit && npx tsc --noEmit && npm run lint`
Expected: PASS / clean.

- [ ] **Step 8: Commit**

```bash
git add adk-web-ui/lib/analytics adk-web-ui/components/analytics
git commit -m "feat(ops): builder funnel and insights track zips, emails and help

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Sentry scrubbing, copy, env docs and e2e

**Files:**
- Modify: `adk-web-ui/lib/sentry-scrub.ts`, test `adk-web-ui/lib/sentry-scrub.test.ts`
- Modify: `adk-web-ui/app/privacy/page.tsx`, `adk-web-ui/app/about/page.tsx`
- Modify: `adk-web-ui/env.example` (replace the `BLUEPRINT_*` section at the end)
- Create: `adk-web-ui/e2e/build.spec.ts`

**Interfaces:**
- Consumes: everything above (UI names from Tasks 2, 6, 7; route behaviour from Tasks 5, 7).
- Produces: final copy and docs; e2e coverage.

- [ ] **Step 1: Write the failing scrub test**

In `adk-web-ui/lib/sentry-scrub.test.ts` replace the whole `describe('blueprint save scrubbing', ...)` block with:

```ts
describe('build save scrubbing', () => {
  const LINK_TOKEN = 'Ab3_-'.repeat(8) + 'xyz';

  it('redacts build limiter keys and email addresses', () => {
    const out = redactUrl(`limit bd:a:${TOKEN} bd:u:user-1 bd:ip:deadbeef for Someone.Name+tag@example.co.uk`);
    assert.ok(!out.includes(TOKEN));
    assert.ok(!out.includes('user-1'));
    assert.ok(!out.includes('deadbeef'));
    assert.ok(!out.includes('example.co.uk'));
    assert.match(out, /bd:\[redacted\]/);
    assert.match(out, /\[email\]/);
  });

  it('redacts link tokens in page and API paths', () => {
    assert.equal(redactUrl(`https://site.test/builds/${LINK_TOKEN}`), 'https://site.test/builds/[redacted]');
    assert.equal(redactUrl(`GET /api/builds/${LINK_TOKEN}/zip`), 'GET /api/builds/[redacted]/zip');
    assert.equal(redactUrl('POST /api/builds'), 'POST /api/builds');
  });

  it('still redacts legacy blueprint keys', () => {
    assert.equal(redactUrl(`bp:a:${TOKEN}`), 'bp:[redacted]');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test lib/sentry-scrub.test.ts`
Expected: FAIL — `bd:` keys and `/builds/<token>` pass through.

- [ ] **Step 3: Extend the scrubber**

In `adk-web-ui/lib/sentry-scrub.ts`:
- Replace the module doc comment's tail "(which appears in backend URLs as /users/a_<token>/ and in limiter keys as run:a:<token> or bp:a:<token>), nor email addresses from blueprint saves." with "(which appears in backend URLs as /users/a_<token>/ and in limiter keys as run:a:<token>, bd:a:<token> or the legacy bp:a:<token>), nor email addresses or /builds/<token> link tokens from emailed builds."
- Replace the body of `redactUrl` with:

```ts
  return value
    .replace(/\/users\/[^/?#\s]+/g, '/users/[redacted]')
    .replace(/\/builds\/[A-Za-z0-9_-]+/g, '/builds/[redacted]')
    .replace(/(run|bp|bd):(?:a:[0-9a-f]+|ip:[0-9a-f]+|u:[^\s]+)/g, '$1:[redacted]')
    .replace(/[^\s@/?#&=]+@[^\s@/?#&=]+\.[A-Za-z]{2,}/g, '[email]');
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test lib/sentry-scrub.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the copy**

In `adk-web-ui/app/privacy/page.tsx`:
- Replace both occurrences of `'How Agent Directory handles visits, cookies, sign-in and saved blueprints.'` / `"How Agent Directory handles visits, cookies, sign-in and saved blueprints."` with `How Agent Directory handles visits, cookies, sign-in and builds you email yourself.` (keep the surrounding quote style).
- Replace the whole `<ProseSection title="Saved blueprints" id="blueprints">…</ProseSection>` with:

```tsx
      <ProseSection title="Builds you email yourself" id="builds">
        <p>
          Every agent the builder packages is recorded without personal data: its name, the options, models,
          tools and skills it uses, and its size. We use these counts to improve the builder.
        </p>
        <p>
          When you choose &ldquo;Email me a permanent link&rdquo;, we store your email address, the zip and that
          build summary so we can send you the link and serve the download, plus your account id if you are
          signed in. The email is sent through our email provider (Resend). We only send you that email unless
          you tick &ldquo;Send me updates about the builder and nuvel&rdquo;; then your address is added to our
          updates list. If you tick &ldquo;I&apos;d like help deploying it&rdquo;, the site owner is notified so
          they can get in touch. We do not sell or share your email.
        </p>
        <p>
          &ldquo;Delete this build&rdquo; on the link page removes your email address and the zip straight away,
          and the link stops working. Blueprints saved with an earlier version of the builder are kept; to have
          one deleted, contact us as below.
        </p>
      </ProseSection>
```

In `adk-web-ui/app/about/page.tsx` replace

```tsx
            why. The design collects in a blueprint you can copy, download or save. When you agree, it builds
            the agent on{' '}
            <a href={NUVEL_URL} target="_blank" rel="noreferrer" className={proseLink}>nuvel</a>
            {' '}and hands you a zip: server, plugins, guardrails, Dockerfile and tests included.
```

with

```tsx
            why. When you agree, it builds the agent on{' '}
            <a href={NUVEL_URL} target="_blank" rel="noreferrer" className={proseLink}>nuvel</a>
            {' '}and hands you a zip: server, plugins, guardrails, Dockerfile and tests included. Download it
            right away, or email yourself a permanent link to it.
```

- [ ] **Step 6: Document the env vars**

In `adk-web-ui/env.example`, replace everything from the line `# Builder blueprints (POST /api/blueprints). All optional.` to the end of the file with:

```bash
# "Email me my build" (POST /api/builds, /builds/<token>). All optional.
# Links use NEXT_PUBLIC_BASE_URL (above), falling back to the request origin;
# the email names the site by that host. Without RESEND_API_KEY and
# BUILD_EMAIL_FROM the feature runs in dev mode: the link is logged to the
# server console and shown in the dialog instead of emailed.
# Resend API key. A sending-only key is enough unless RESEND_SEGMENT_ID is set
# (adding contacts needs a full-access key).
RESEND_API_KEY=
# Sender on a domain verified in Resend, e.g. "Builds <builds@your-domain>".
BUILD_EMAIL_FROM=
# Optional reply-to address for the link email.
BUILD_EMAIL_REPLY_TO=
# Visitors who tick "Send me updates" are added to this Resend segment.
RESEND_SEGMENT_ID=
# Largest zip stored, in bytes (default 10 MB).
BUILD_MAX_ZIP_BYTES=10485760
# Owner notification: receives {type:"build.saved", id, email, signedIn,
# projectName, updates, help, text, markdown} (Slack/Zapier/email relay).
# Secret is sent as "Authorization: Bearer <secret>". Unset = no notification.
# Falls back to BLUEPRINT_WEBHOOK_URL / BLUEPRINT_WEBHOOK_SECRET.
BUILD_WEBHOOK_URL=
BUILD_WEBHOOK_SECRET=
# https booking link shown when the visitor asks for help deploying.
# Falls back to BLUEPRINT_BOOKING_URL. Unset = no link.
BUILD_BOOKING_URL=
# Daily limits on emailed builds (signed-in user / anonymous visitor / anonymous IP).
# Fall back to BLUEPRINT_SAVE_*_DAILY, then 10 / 3 / 10.
BUILD_SAVE_USER_DAILY=10
BUILD_SAVE_ANON_DAILY=3
BUILD_SAVE_ANON_IP_DAILY=10
```

- [ ] **Step 7: Write the e2e spec**

`adk-web-ui/e2e/build.spec.ts`:

```ts
import { test, expect, type Page, type Route } from '@playwright/test';

const BUILD = {
  name: 'research-summarizer',
  package: 'research_summarizer',
  description: 'Searches the web for a topic and writes a sourced one-page summary.',
  options: { with_eval: true, with_slack: false },
  models: { fast: 'openrouter/google/gemini-2.5-flash', reasoning: null },
  tools: ['web_search'],
  skills: ['sourced-summary'],
  artifact: 'research-summarizer.zip',
  version: 0,
  files: 41,
  bytes: 58213,
  packagedAt: '2026-10-04T09:12:00Z',
};
/** An empty zip (end-of-central-directory record only). */
const ZIP_DATA_URL = 'data:application/zip;base64,UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==';

/** A builder turn whose state_delta carries the build, as package_agent writes it. */
async function stubBuilderTurn(page: Page) {
  await page.route('**/api/run_sse', async (route) => {
    const event = {
      author: 'adk_agent_builder',
      content: { role: 'model', parts: [{ text: 'Packaged research-summarizer.' }] },
      actions: { state_delta: { 'builder:build': BUILD } },
    };
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: `data: ${JSON.stringify(event)}\n\n`,
    });
  });
}

/** /api/artifacts: the list the chat loads after a turn, and the single-artifact download. */
async function stubArtifacts(page: Page, requests: URL[], single: (route: Route) => Promise<void> = fulfillZip) {
  await page.route(
    (url) => url.pathname === '/api/artifacts',
    async (route) => {
      const url = new URL(route.request().url());
      requests.push(url);
      if (url.searchParams.get('artifact_name')) return single(route);
      return fulfillZip(route);
    },
  );
}

async function fulfillZip(route: Route) {
  await route.fulfill({
    json: { success: true, data: [{ id: BUILD.artifact, name: BUILD.artifact, type: 'file', url: ZIP_DATA_URL }] },
  });
}

async function getBuildCard(page: Page) {
  await page.goto('/chat');
  const composer = page.locator('textarea').last();
  await expect(composer).toBeEnabled({ timeout: 30_000 });
  await composer.fill('Build a research summarizer');
  await composer.press('Enter');
  const card = page.getByRole('group', { name: 'Build: research-summarizer' });
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

test('the build card renders and the zip is not listed twice', async ({ page }) => {
  const requests: URL[] = [];
  await stubBuilderTurn(page);
  await stubArtifacts(page, requests);
  const card = await getBuildCard(page);
  await expect(page.getByText('Packaged research-summarizer.')).toBeVisible();
  await expect(card).toContainText('41 files · 1 tool · 1 skill · 56.8 KB');
  await expect(card.getByText('Eval', { exact: true })).toBeVisible();
  await expect(card.getByText('Slack', { exact: true })).toHaveCount(0);
  // After the turn the chat loads the session's artifacts; the zip is folded into the card.
  await expect.poll(() => requests.some((u) => !u.searchParams.get('artifact_name'))).toBe(true);
  await expect(page.getByText('research-summarizer.zip', { exact: true })).toHaveCount(0);
});

test('Download requests the single-artifact URL', async ({ page }) => {
  const requests: URL[] = [];
  await stubBuilderTurn(page);
  await stubArtifacts(page, requests);
  const card = await getBuildCard(page);
  const download = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Download zip' }).click();
  expect((await download).suggestedFilename()).toBe('research-summarizer.zip');
  const single = requests.find((u) => u.searchParams.get('artifact_name'));
  expect(single?.searchParams.get('app_name')).toBe('adk_agent_builder');
  expect(single?.searchParams.get('artifact_name')).toBe('research-summarizer.zip');
  expect(single?.searchParams.get('version')).toBe('0');
  expect(single?.searchParams.get('session_id')).toMatch(/^session-/);
});

test('a lost zip asks to package it again', async ({ page }) => {
  await stubBuilderTurn(page);
  await stubArtifacts(page, [], (route) => route.fulfill({ status: 404, json: { success: false, code: 'not_found', error: 'x' } }));
  const card = await getBuildCard(page);
  await card.getByRole('button', { name: 'Download zip' }).click();
  await expect(card.getByRole('alert')).toContainText('package it again');
});

test('the email dialog posts the right body and shows Check your inbox', async ({ page }) => {
  const posted: unknown[] = [];
  await stubBuilderTurn(page);
  await stubArtifacts(page, []);
  // The API is covered by unit tests; here it is stubbed so the spec needs no DB, ADK or Resend.
  await page.route('**/api/builds', async (route) => {
    posted.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true, data: { id: 'x', sent: true, bookingUrl: 'https://cal.example.com/book' } } });
  });
  const card = await getBuildCard(page);
  await card.getByRole('button', { name: 'Email me a permanent link' }).click();

  const dialog = page.getByRole('dialog', { name: 'Email me a permanent link' });
  const send = dialog.getByRole('button', { name: 'Send link' });
  await expect(send).toBeDisabled();
  await expect(dialog.getByRole('checkbox', { name: 'Send me updates about the builder and nuvel' })).not.toBeChecked();
  await dialog.getByRole('textbox', { name: 'Email' }).fill('delivered@resend.dev');
  await dialog.getByRole('checkbox', { name: "I'd like help deploying it" }).check();
  await send.click();

  const done = page.getByRole('dialog', { name: 'Check your inbox' });
  await expect(done).toContainText('delivered@resend.dev');
  await expect(done.getByRole('link', { name: 'Book a call' })).toHaveAttribute('href', 'https://cal.example.com/book');
  expect(posted).toHaveLength(1);
  expect(posted[0]).toEqual({ email: 'delivered@resend.dev', sessionId: expect.stringMatching(/^session-/), updates: false, help: true });
});

test('dev mode shows the link itself', async ({ page }) => {
  await stubBuilderTurn(page);
  await stubArtifacts(page, []);
  await page.route('**/api/builds', (route) =>
    route.fulfill({ json: { success: true, data: { id: 'x', sent: false, link: 'http://localhost:3000/builds/abc' } } }),
  );
  const card = await getBuildCard(page);
  await card.getByRole('button', { name: 'Email me a permanent link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Email me a permanent link' });
  await dialog.getByRole('textbox', { name: 'Email' }).fill('delivered@resend.dev');
  await dialog.getByRole('button', { name: 'Send link' }).click();
  const done = page.getByRole('dialog', { name: 'Your build link' });
  await expect(done.getByRole('link', { name: 'http://localhost:3000/builds/abc' })).toBeVisible();
});

test('the builds API validates input and rejects other origins', async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bad = await request.post('/api/builds', {
    headers: { Origin: origin },
    data: { email: 'nope', sessionId: 'session-1', updates: false, help: false },
  });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error).toMatch(/valid email/i);

  const foreign = await request.post('/api/builds', {
    headers: { Origin: 'https://evil.example' },
    data: { email: 'delivered@resend.dev', sessionId: 'session-1', updates: false, help: false },
  });
  expect(foreign.status()).toBe(403);
});

test('an unknown build link is a plain 404 that is never indexed', async ({ request }) => {
  const res = await request.get('/builds/not-a-token');
  expect(res.status()).toBe(404);
  expect(res.headers()['x-robots-tag']).toContain('noindex');
  expect(res.headers()['referrer-policy']).toBe('no-referrer');
  const zip = await request.get('/api/builds/not-a-token/zip');
  expect(zip.status()).toBe(404);
});

// Needs a real saved build: run the dev-mode flow (Task 5/7 manual steps) and
// export E2E_BUILD_TOKEN=<token from the logged link> before running.
test('the build page downloads and deletes (dev mode)', async ({ page, request }) => {
  const token = process.env.E2E_BUILD_TOKEN;
  test.skip(!token, 'set E2E_BUILD_TOKEN to a token from a dev-mode build link');
  await page.goto(`/builds/${token}`);
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download zip' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);

  await page.getByRole('button', { name: 'Delete this build' }).click();
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expect(page.getByRole('heading', { name: 'Build deleted' })).toBeVisible();
  expect((await request.get(`/api/builds/${token}/zip`)).status()).toBe(404);
});
```

- [ ] **Step 8: Run the e2e spec**

Run (from `adk-web-ui/`, dev server auto-starts): `npm run test:e2e -- e2e/build.spec.ts`
Expected: all tests PASS except `the build page downloads and deletes (dev mode)`, which is SKIPPED unless `E2E_BUILD_TOKEN` is set. With a token from the Task 7 manual flow: `E2E_BUILD_TOKEN=<token> npm run test:e2e -- e2e/build.spec.ts` → that test PASSES too (it deletes the build, so mint a fresh token for each run).

- [ ] **Step 9: Full verification**

Run (from `adk-web-ui/`):

```bash
npm run lint
npm run lint:tokens
npx tsc --noEmit
npm run test:unit
npm run build
npm run test:e2e
```

Expected: lint and typecheck clean; all unit tests PASS; `next build` succeeds and lists `/builds/[token]`, `/api/builds`, `/api/builds/[token]`, `/api/builds/[token]/zip` as dynamic routes; e2e PASS (with the token-gated test skipped unless configured).

Then confirm nothing deployment-specific slipped in:

Run: `grep -rnE "folch|agentdirectory\.|@[a-z0-9-]+\.(ai|com|io)" adk-web-ui/lib/build adk-web-ui/app/api/builds adk-web-ui/app/builds adk-web-ui/components/build`
Expected: no output.

Manual (spec "Manual" list): with a Resend test key and `BUILD_EMAIL_FROM` on a verified domain, email a build to `delivered@resend.dev` and confirm the email in the Resend dashboard (subject "Your agent: <name>", link to `${NEXT_PUBLIC_BASE_URL}/builds/<token>`, idempotency key `build-link/<id>` in the request log); open the link, download, delete; open `/analytics/ops` and check the funnel shows "Got a zip" → "Emailed it" → "Asked for help" and the "Latest builds" panel.

- [ ] **Step 10: Commit**

```bash
git add adk-web-ui/lib/sentry-scrub.ts adk-web-ui/lib/sentry-scrub.test.ts adk-web-ui/app/privacy/page.tsx adk-web-ui/app/about/page.tsx adk-web-ui/env.example adk-web-ui/e2e/build.spec.ts
git commit -m "docs(builds): privacy and about copy, env docs, Sentry scrubbing, e2e

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage (web):** stream → chat (Task 2); BuildCard with download and 404 handling (Tasks 2, 6); EmailBuildDialog incl. prefill, two unticked boxes, privacy notice, "Check your inbox", booking link, dev-mode link (Task 6); `POST /api/builds` steps 1–11 (Tasks 4, 5); `/builds/[token]` page, zip download with `Content-Disposition`, download counting, delete, unknown-token 404, noindex/no-referrer (Task 7); `build_saves` table + migration 0015 + bootstrap (Task 3); env vars (Tasks 4, 9); blueprint removal with the legacy schema kept (Task 2); ops analytics (Task 8); sentry-scrub (Task 9); copy (Task 9); tests listed under vitest/route/e2e (Tasks 1–9).
- **Extra safeguards not in the spec text but required by its intent:** `/builds/` is excluded from pageview tracking (otherwise tokens would land in `page_views`), and `next.config.ts` sends the noindex/no-referrer headers on the 404 path as well.
