# Web UI roadmap (handoff for agents)

Self-contained brief for continuing the `adk-web-ui/` refactor. Read it fully before starting a sub-project.

## Where things stand (2026-10-03)

Merged to `main`:

| PR | What |
|---|---|
| #29–#33 | API hardening (server-side identity, rate limits, stream guard), security headers + CSP (report-only), Sentry, web CI, container image, backend internal token |
| #34 | Removed Trending / Learn / Contribute (308 redirects), dead code, lighter chat bundle (lazy Mermaid, PrismLight), accurate metadata, "not an official Google product" notice |
| #35 | Light / Dark / System theme (no-flash head script), self-hosted Google Sans Flex + Code, M3 shape/elevation tokens, `npm run lint:tokens` alias guard |
| #36 | Backend `agents/uv.lock` committed + `uv sync --frozen`; google-adk pinned 1.32.0, `mcp<2`; builder's `mcpdoc` pinned |
| #37 | M3 primitives in `components/ui/` (Button, Chip, Card, Dialog, Sheet, DropdownMenu, Tooltip, Input, Snackbar), pill top bar + Account menu, migrated agent/sessions/settings/about/privacy/signin/error pages |

On branch `claude/determined-heisenberg-pr5xqk` (not yet merged): sub-projects **2**, **3** and **4** below are implemented. Blueprint saves need `BLUEPRINT_WEBHOOK_URL` / `BLUEPRINT_WEBHOOK_SECRET` / `BLUEPRINT_BOOKING_URL` set on the frontend (see `adk-web-ui/env.example`); the table is created by migration `0014_blueprint_submissions` and also bootstraps itself on first save.

## Ground rules (all sub-projects)

- **Public repo.** Keep code, comments, commits and PR text neutral and technical. Never commit `docs/superpowers/**`, `docs/runbooks/**`, `.superpowers/**`.
- **Not affiliated with Google.** The site may say "built with Google's Agent Development Kit"; it must never present itself or its agents as Google's. Keep `NOT_AFFILIATED_NOTICE` (`lib/site.ts`) in the footer and on About.
- **Styling.** Use `md-*` tokens (`bg-md-surface`, `text-md-on-surface-variant`, …) and `components/ui/*`. Shapes: buttons/top bar `rounded-full`; chips 8px; inputs 12px; cards 16px; dialogs/composer 28px (`--md-shape-*`). Do not add new uses of the deprecated aliases (`bg-primary`, `text-muted-foreground`, `border-border`, …); `npm run lint:tokens` fails CI on new ones. The alias block is gone from `app/globals.css` and the allowlist is empty, so any alias use now fails `lint:tokens`.
- **Theme.** `.dark` on `<html>` is the source of truth (`lib/theme.ts`, `components/theme/*`); read it with `useDarkMode()` (`lib/hooks/useDarkMode.ts`).
- **Gate (CI):** from `adk-web-ui/`: `npx eslint . && npm run lint:tokens && npx tsc --noEmit && npm run test:unit && npm run build` (build needs `DATABASE_URL=postgres://ci:ci@localhost:5432/ci AUTH_SECRET=ci SKIP_ENV_VALIDATION=true`). E2E: `npx playwright test` (set `E2E_BASE_URL` to your own dev server port; never assume 3000 is free).
- **Tests.** Unit tests are `lib/**/*.test.ts` with `node:test`. UI behavior is covered with Playwright in `e2e/`. Write the failing test first.
- **Data safety.** Never use a production `DATABASE_URL` or `SESSION_SERVICE_URI` for dev/tests. Local DB: `npm run db:dev:up && npm run db:dev:reset` (Docker Postgres + Neon HTTP proxy, see `adk-web-ui/README.md`). The repo-root `.env` may point at production — override `SESSION_SERVICE_URI` when running the backend locally.
- **Local backend** (optional, for real chats): `cd agents && uv sync --frozen`, then from the repo root `SESSION_SERVICE_URI=postgresql://postgres:postgres@db.localtest.me:5433/main DB_SSL=disable ADK_ALLOW_UNAUTHENTICATED=1 AGENTS_DIR=agents PORT=8000 HOST=127.0.0.1 agents/.venv/bin/python run_adk.py`, and run the web app with `ADK_SERVER_URL=http://127.0.0.1:8000`. Without a backend, `/api/agents` falls back to the bundled catalog.
- **Signed-in UI checks:** `useSession` reads `/api/auth/session`; in Playwright, `page.route('**/api/auth/session', r => r.fulfill({ json: { user: { name: 'Test', email: 't@localhost.test' }, expires: '2099-01-01T00:00:00.000Z' } }))` renders the signed-in nav.
- **Deploys:** frontend on Vercel project `adk-samples`; backend on Railway project `adk-samples`, environment **staging** (that is the live backend). Do not set `PORT` on Railway.
- Small PRs, one concern each. Do not force-push.

## Sub-project 2 — Builder-first shell

Goal: the agent builder (`adk_agent_builder`, the most-used agent) is the front door; the directory becomes a showcase of examples.

Scope:
1. **Home (`app/page.tsx`)**: hero = a composer ("Describe the agent you want to build…") that starts a builder chat (`/chat?agent=adk_agent_builder&prompt=…`, ideally auto-send). 3–4 example prompt chips. Below: "Examples" — a curated grid of the other agents (reuse `AgentGrid`/`AgentCard`, restyled on `Card`/`Chip`). Visual reference: Material 3, Google-search-style composer (28px, `surface-container-high`).
2. **Nav**: rename "Agents" → "Examples" (route can stay `/`, or move the grid to `/examples` with a redirect); add "Build" as the primary destination.
3. **`/chat` with no `?agent`** defaults to the builder instead of the disabled "select an agent" state (`app/chat/page.tsx`).
4. **Agent pages (`app/agents/[name]/page.tsx`)**: render on the server with `generateMetadata` (title/description/OG per agent) using `lib/agent-metadata.ts` / the catalog; keep client islands only for star/share.
5. **Copy and branding**: About still says "Discover, use, and contribute agents" and "powered by Google Gemini 3 Flash" — rewrite. The builder agent's logo is Google's "G"; replace with a neutral icon (agent `metadata.json` logo field + `public/`). Consider a site logo of your own instead of the ADK logo (`public/adk_logo.png`).
6. Migrate `AgentGrid`, `AgentCard`, `app/page.tsx` off deprecated aliases.

Done when: home shows the builder hero + examples; `/chat` defaults to the builder; agent pages have per-agent metadata in the HTML (`curl | grep og:title`); e2e covers hero → chat with prompt, examples grid, `/chat` default.

## Sub-project 3 — Chat workspace

Goal: a maintainable chat that can render structured outputs (needed by 4).

Facts: `lib/hooks/useStreamingChat.ts` (~690 lines) does SSE parsing, text dedupe, sub-agent routing, rate-limit parsing, artifact fetch, guide parsing, stop/partial paths and analytics. `components/chat/MessageBubble.tsx` hard-codes guide/maps branches. `MessageList` passes ~14 props. `app/chat/page.tsx` uses `h-[calc(100dvh-4rem)]` although the nav is hidden on `/chat` (4rem lost). Anonymous chats are lost on refresh. Agent switching requires going back to the directory. Existing structured-output pattern: `agents/google_explorer_agent/callbacks/guide_document.py` writes `state["guide:document"]`; the client reads it from `state_delta` (`lib/adk-client.ts`) with a fenced-code fallback (`lib/guide/parse.ts`) and renders `GuideAnswer`.

Scope:
1. Split `useStreamingChat` into pure, unit-tested modules (SSE event reducer, text assembly/dedupe, sub-agent routing, rate-limit parsing) plus a thin hook. Keep behavior identical; add `lib/**/*.test.ts` for each module.
2. **Renderer registry**: map message payload types (`text`, `guide`, `maps`, `artifact`, future `blueprint`) to components; `MessageBubble` and `StreamingBubble` share it instead of duplicating branches.
3. Fix the height bug; add an agent switcher in the chat header (`DropdownMenu`); show `NOT_AFFILIATED_NOTICE` in small text under the composer (footer is hidden on `/chat`).
4. Anonymous history: persist the current conversation per agent in `localStorage` (try/catch, cap size) so refresh restores it.
5. Migrate chat components off deprecated aliases; then delete the alias block from `app/globals.css` and the allowlist mechanism's remaining entries.
6. Known follow-ups to include: Mermaid builds a new diagram id every render (`components/chat/markdown.tsx` passes no stable `id`); keep `securityLevel: 'strict'`.

Done when: behavior parity (existing e2e + new unit tests), renderer registry in place with guide/maps moved into it, no deprecated aliases left, `lint:tokens` allowlist empty.

## Sub-project 4 — Blueprint and follow-up (after 3)

Goal: the builder produces a structured **blueprint** of the user's agent, and the user can save it and ask for follow-up.

Scope:
1. **Backend** (`agents/adk_agent_builder/`): when the design is settled, the agent writes a structured blueprint to session state (e.g. `state["blueprint:document"]` via a callback or tool, mirroring `guide_document.py`): name, goal, agents and their roles, tools, data sources, model choices, risks/next steps, optional code skeleton. Define it as a Pydantic model; keep the fenced-JSON fallback.
2. **Frontend**: a `blueprint` renderer in the registry from 3 — a side panel with sections, copy-as-Markdown and download.
3. **Save + follow-up** (signed-in or email): a dialog ("Save your blueprint?") with email, explicit consent checkbox and an optional booking link; store blueprint + email + consent timestamp in Postgres (new Drizzle table + migration), send a notification to the site owner (email or webhook, configured by env), and show the booking link. Rate-limit the endpoint, validate input, same-origin guard (see existing API helpers in `lib/api-response.ts`, `lib/origin-guard.ts`), no PII in logs or Sentry (`lib/sentry-scrub.ts`).
4. Privacy page update for the new data.

Done when: a real builder conversation yields a blueprint panel; saving stores a row (local DB in tests), triggers the notification (mocked in tests), and shows the booking link; e2e covers the dialog with consent required.

## Other open follow-ups

- CSP is report-only. Enforcing it needs nonces (Next inline scripts, GA), plus the theme script hash `THEME_INIT_SCRIPT_SHA256` in `lib/theme.ts`.
- Optional move of the frontend from Vercel to Railway (private networking to the backend).
- `e2e/resume.spec.ts` expects a "Your sessions" heading the page doesn't render; update the spec.
- Mobile Sheet stays open past the breakpoint; sort menu should use radio items; interactive `Chip` can't take `disabled`.
- Mark GitGuardian findings for the local dev DB password as test credentials.
