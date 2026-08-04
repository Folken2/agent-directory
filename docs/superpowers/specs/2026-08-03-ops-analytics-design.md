# Ops Analytics — Decision Dashboard Design

**Date:** 2026-08-03
**Status:** Approved (user: Approach B hybrid, Signals + Explorer, stamp both identifiers)
**Extends:** `2026-08-03-consent-ga-engagement-design.md`

## Goal

Answer product questions from the data the directory already collects: which agents to
build next, which to deprecate, which pages to keep. The dashboard at `/analytics/ops`
should hand over findings, not just charts, while still allowing raw exploration.

## Baseline measured on 2026-08-03

The current ops page reads `engagement_events`, which is the thinnest table we have.
Real history lives in the ADK-owned tables.

| Table | Rows | Earliest | Notes |
|---|---|---|---|
| `events` (ADK) | 2,367 total / 490 `author='user'` | 2025-12-10 | Prompt text in `content->parts[].text` |
| `sessions` (ADK) | 356 | 2025-12-10 | All `user_id='default-user'` |
| `agent_run_events` | 937 rows / 459 terminal runs | 2025-12-12 | One row per status change; count terminal only |
| `page_views` | 1,803 (1,565 human) | 2026-07-16 | Bot-classified |
| `engagement_events` | 7 | 2026-08-03 | Consent-gated; stays sparse |

Everything is in one Neon database (`SESSION_SERVICE_URI` and `DATABASE_URL` point at the
same instance), so prompts, runs and page views join in plain SQL with no ETL.

## Decisions

| Topic | Choice |
|---|---|
| Primary usage source | `agent_run_events` + ADK `events`, **not** `engagement_events` |
| Demand signal | Mine existing prompts. **No** search-term tracking added |
| GA4 | Narrow server-side Data API panel: channel, device, new vs returning |
| Layout | Two modes: Signals (findings) and Explorer (filterable tables) |
| Prompt text | Aggregated by default; raw text behind an explicit toggle |
| `/privacy` copy | **Not** updated in this iteration (deliberate; revisit before wider use) |
| Identity bridge | Stamp both `ad_vid` and anon session token; label coverage per metric |
| Page journeys | Sequenced by `hashed_ip` + 30-min window, not by `visitor_id` |
| Rollups | None. Volumes are small; query live behind `unstable_cache` |
| Access | Existing `isAnalyticsOpsEmail` gate |

## Identity

ADK stamps every session, event and run with `user_id='default-user'`, but
`agent_run_events.rate_limit_identifier` already bridges to a real actor:

- 167 runs / 12 distinct authenticated user UUIDs
- 770 runs / 393 distinct anonymous session tokens

Those two identifier kinds must be reported separately, never summed. Authenticated UUIDs
are stable, so they count people — but only 5 signed-in users have ever run the busiest
agent. Anonymous tokens rotate per browser session, so they count sessions and track the
run count closely (`adk_agent_builder`: 165 runs, 5 authed users, 127 anon sessions). A
combined "actors" figure reads like an audience size and is not one.

The gap is page views → chat. `ad_vid` only persists when `ad_consent=all`; otherwise
middleware mints an ephemeral UUID per hit. Measured consequence: of ~1,298 distinct
human `visitor_id` values, only **40 have more than one page view** (307 views). The rest
are one-shot IDs.

**Change:** add two nullable columns to `agent_run_events`, populated in `trackAgentRun`
from server-side cookies:

| Column | Source | Coverage |
|---|---|---|
| `visitor_id` | `ad_vid` cookie | Consented visitors only |
| `anon_session_token` | Existing rate-limit session cookie | All anonymous traffic |

Funnel queries prefer `visitor_id` and fall back to `anon_session_token`. Every funnel
number in the UI carries its coverage basis so a low count is never read as low interest.

### Page journeys use `hashed_ip`

Neither cookie can sequence page paths for most traffic. `hashed_ip` can: it is populated
on 100% of human views (1,597/1,597), yields 576 distinct values, and 84 of those visited
more than one path across 981 views — 61% coverage versus 2% for consented `ad_vid`.

Journeys, entry pages and onward rate are therefore computed per `hashed_ip` within a
30-minute inactivity window. This is a coarse session proxy: shared NAT collapses several
people into one, and a changing mobile IP splits one person into several.

## Correctness fix

`/analytics` currently reports distinct `visitor_id` as distinct people, which counts
ephemeral per-hit UUIDs (~1,298 today for ~40 genuinely returning visitors). Change to
three honestly-labelled numbers:

- **Visits** — raw human pageview count (unchanged meaning)
- **People (approx.)** — distinct `hashed_ip`, 576 today; labelled as an IP-based estimate
- **Returning** — distinct persistent `ad_vid`, 40 today; the consented subset

## Signals panel

Six deterministic heuristics. Each renders a finding, the evidence, and a suggested
action. No LLM in v1.

| Signal | Rule | Example as of 2026-08-03 |
|---|---|---|
| Dead agents | No runs in 90d | `resume_screener` (Jan), `simple_agent_maps_grounded` (Mar), `tavily_mcp_agent` (May) |
| High friction | Error rate over threshold, min run count | `data_analyst_agent` 4/20, `tavily_mcp_agent` 6/52 |
| Interest without use | Page views > 0 and no runs since pageview tracking began | Fix the agent, not the pitch |
| Dead pages | Views, but no onward navigation in the journey and no run | `/` bounces 374 of 403 entries |
| Missing pages | Repeat 404s on plausible page paths from distinct visitors | Only `/search` clears the bar today |
| Demand themes | Stopword-filtered term frequency over user prompts | Upgrade path: LLM clustering |
| Traffic quality | Human vs bot share; scanner views called out separately | 590 non-bot views were credential scans |

### Path classification

Requests are classified four ways, not two, because a non-route can mean very different
things. Measured over all 503 recorded paths:

| Kind | Paths | Views | Non-bot views |
|---|---|---|---|
| `page` | 25 | 1,055 | 967 |
| `scanner` | 450 | 741 | 590 |
| `missing` | 26 | 31 | 31 |
| `infra` | 2 | 9 | 9 |

Only 25 of 503 paths are real routes. Scanners spoof browser user-agents, so **590 views
that the old queries counted as human were credential sweeps** (`/.env`,
`/wp-config.php.bak`, hundreds of one-off `.php` probes) — 38% of apparent human traffic.

Classification allowlists real routes and tests only unrecognised paths against hostile
patterns, so a new page can never be mistaken for an attack. A unit test compares the
route list against `app/**/page.tsx` and fails on drift.

`missing` is a candidate signal, not a finding: today's 404s are dominated by a
contact-page scraper walking locales (`/kontakt`, `/contacto`, `/contatti`, `/impressum`,
`/get-in-touch`), one hit each. The signal therefore requires repeat hits from distinct
visitors, which currently leaves only `/search`.

## Explorer

Four tabs, each with the existing `TimelineRange` filter plus sort and text search:

- **Agents** — runs, errors, distinct actors, last used, page views, run-per-view rate
- **Pages** — views, distinct visitors, entry share, onward rate, bot share
- **Prompts** — per-agent counts and themes; raw text behind toggle
- **Traffic** — referrers, UTM, countries, bot companies

## GA4 panel

- New env: `GA4_PROPERTY_ID`, service account JSON. The existing Viewer-only service
  account is sufficient for Data API reads.
- Dimensions kept to what first-party does not measure: session default channel group,
  device category, new vs returning.
- Labelled as a consent-only sample. GA numbers are not reconciled against first-party
  counts and the UI says so.
- Absent env → panel renders a configuration hint, no error.

**Sequencing note:** the GA4 web stream was created 2026-08-03, so this panel has hours of
history at build time and will look empty for weeks. Build it last; it must not gate the
first-party work shipping.

## Out of scope

- LLM prompt clustering and lead scoring
- Nightly rollup tables / cron
- `/privacy` disclosure copy for operator prompt review
- Backfilling identity onto historical rows
