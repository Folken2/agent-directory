# Ops Analytics Decision Dashboard — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Turn `/analytics/ops` into a decision tool — Signals (findings + suggested
actions) plus an Explorer (filterable tables) — re-based on `agent_run_events` and ADK
`events` instead of the near-empty `engagement_events`.

**Design:** `docs/superpowers/specs/2026-08-03-ops-analytics-design.md`

**Architecture:** All tables live in one Neon instance, so prompts, runs and page views
join in SQL. Queries run live behind `unstable_cache` (volumes are in the low thousands).
Page journeys sequence on `hashed_ip` + 30-min window. GA4 arrives last via the Data API.

**Tech Stack:** Next.js App Router, Drizzle/Neon, `@google-analytics/data`

## Global Constraints

- Do not run `drizzle-kit migrate` on Vercel build; use runtime `ensure-schema`
- Never read ADK `events` / `agent_run_events` from routes or components directly — go
  through a data-layer module, following the ownership convention in `lib/sessions.ts`
- Do **not** modify `app/privacy/page.tsx` in this iteration (explicit user decision)
- Ops-only surfaces stay behind `isAnalyticsOpsEmail` and `robots: noindex`
- No secrets in repo; GA4 env vars are optional and absence must not error

---

### Task 1: Ops analytics data layer + tests — DONE

**Files:**
- Created `adk-web-ui/lib/analytics/path-classify.ts` (+ test) — named for what it does;
  classification is four-way, not a scanner blocklist
- Created `adk-web-ui/lib/analytics/visit-journeys.ts` (+ test) — pure sessionization split
  out so it is testable without a database
- Created `adk-web-ui/lib/analytics/ops-queries.ts`
- Created `adk-web-ui/lib/drizzle/unwrap-rows.ts` — shared `db.execute` row normalizer

- [x] Four-way path classification (`page` / `infra` / `scanner` / `missing`) by route
      allowlist, with a drift test against `app/**/page.tsx`
- [x] Agent rollup: terminal runs, errors, `authedUsers` and `anonSessions` reported
      separately, prompts, agent page views, first/last run
- [x] Page rollup: views, distinct `hashed_ip`, bot share, scanner paths excluded
- [x] Journey rollup: sessionize human page views by `hashed_ip` + 30-min gap; entries,
      exits, onward rate, bounces
- [x] Prompt rollup: per-agent user-prompt counts from `events` where `author='user'`
- [x] `fetchPageViewsSince()` so "views but no runs" comparisons cannot span the era
      before pageview tracking existed
- [x] 69 unit tests on the pure helpers; verified against production data

### Task 2: Demand themes from prompts

**Files:**
- Create `adk-web-ui/lib/analytics/prompt-themes.ts` (+ test)

- [ ] Extract text via `jsonb_array_elements(content->'parts')`, reusing the SQL shape in
      `lib/sessions.ts`
- [ ] Tokenize, strip stopwords, count uni/bigrams; return top themes with example prompt
      ids and per-agent breakdown
- [ ] Cap prompt length and count per query; deterministic ordering for tests
- [ ] Multilingual safety: do not assume ASCII (real prompts include CJK text)

### Task 3: Signals engine

**Files:**
- Create `adk-web-ui/lib/analytics/signals.ts` (+ test)

- [ ] Six signals from the design: dead agents, high friction, interest without use,
      dead pages, demand themes, traffic quality
- [ ] Each returns `{ id, severity, title, evidence, suggestedAction, coverageBasis }`
- [ ] Thresholds in one exported config object so they are tunable and testable
- [ ] Minimum-sample guards so a 2-run agent never reports a 50% error rate as a finding
- [ ] Tests assert each rule fires and stays silent on fixture data

### Task 4: Identity stamping on runs

**Files:**
- Modify `adk-web-ui/lib/drizzle/schema/agent-run-events.ts`
- Modify `adk-web-ui/lib/analytics/ensure-schema.ts`
- Modify `adk-web-ui/app/api/run/route.ts`, `app/api/run_sse/route.ts`
- Modify the `trackAgentRun` implementation

- [ ] Add nullable `visitor_id` and `anon_session_token` columns + indexes
- [ ] `ensure-schema`: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- [ ] Read `ad_vid` and the rate-limit session cookie server-side; pass both to
      `trackAgentRun`; never fabricate an id when cookies are absent
- [ ] Confirm no behaviour change when both are null (anonymous, no consent)

### Task 5: Public `/analytics` people-count fix

**Files:**
- Modify `adk-web-ui/lib/analytics/stats.ts`, `stats-types.ts`
- Modify `adk-web-ui/components/analytics/AnalyticsPreview.tsx`

- [ ] Replace distinct-`visitor_id` people count with: Visits, People (approx., distinct
      `hashed_ip`), Returning (persistent `ad_vid`)
- [ ] Label People as an IP-based estimate in the UI, not a precise figure
- [ ] Exclude scanner paths from public page counts
- [ ] Update existing stats tests

### Task 6: Ops API routes

**Files:**
- Create `adk-web-ui/app/api/analytics/ops/route.ts`
- Create `adk-web-ui/app/api/analytics/ops/prompts/route.ts`

- [ ] Both routes re-check `isAnalyticsOpsEmail` server-side and 404 otherwise — never
      rely on the page gate alone
- [ ] Accept `range` via `parseTimelineRange`; respond `private, no-store`
- [ ] Prompts route returns aggregates by default; raw text only with an explicit
      `mode=raw` param, capped and paginated

### Task 7: Signals UI

**Files:**
- Create `adk-web-ui/components/analytics/OpsSignals.tsx`
- Modify `adk-web-ui/components/analytics/AnalyticsOpsClient.tsx`

- [ ] Signal cards: finding, evidence, suggested action, coverage label
- [ ] Empty state that explains why a signal has no data yet rather than showing zero
- [ ] Reuse existing Material tokens; no new design system

### Task 8: Explorer UI

**Files:**
- Create `adk-web-ui/components/analytics/OpsExplorer.tsx`
- Create `adk-web-ui/components/analytics/OpsTable.tsx`

- [ ] Four tabs: Agents, Pages, Prompts, Traffic
- [ ] Shared table: client-side sort, text filter, `TimelineRange` selector
- [ ] Prompts tab: aggregated themes by default, raw-text toggle that calls `mode=raw`
- [ ] Link agent rows to `/agents/[name]` and page rows to the live path

### Task 9: GA4 acquisition panel (last)

**Files:**
- Create `adk-web-ui/lib/analytics/ga4.ts`
- Create `adk-web-ui/app/api/analytics/ops/ga4/route.ts`
- Create `adk-web-ui/components/analytics/OpsGa4Panel.tsx`
- Modify `adk-web-ui/env.example`

- [ ] Install `@google-analytics/data`; auth via service account JSON from env
- [ ] Report on channel group, device category, new vs returning only
- [ ] Missing env → panel shows a setup hint; never throws
- [ ] Label as a consent-only sample; state that it will not match first-party counts
- [ ] Note in UI that the GA property started 2026-08-03, so history is short

### Task 10: Verify + ship

- [ ] `npm run test:unit`
- [ ] `npm run lint` and `npx tsc --noEmit`
- [ ] Sanity-check each signal against production data and confirm the examples in the
      design doc still hold
- [ ] Verify `/analytics/ops` 404s for a non-ops session and the API routes 404 too
- [ ] Commit on `feature/ops-analytics`
