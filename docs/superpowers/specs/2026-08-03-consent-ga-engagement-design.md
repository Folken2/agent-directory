# Consent, GA4 Hook & Active-Use Engagement — Design

**Date:** 2026-08-03  
**Status:** Approved (user: Approach 1, autonomous)  
**Extends:** `2026-07-16-visitor-analytics-design.md` (consent was explicitly out of scope there)

## Goal

Know what people want: which agents get active use, which pages humans and crawlers read — while meeting a practical EU cookie posture. Optional Google Analytics 4 when a Measurement ID is configured.

## Decisions

| Topic | Choice |
|---|---|
| Stack | First-party Neon is source of truth; GA4 optional hook |
| Consent UX | Custom Accept / Reject banner (no third-party CMP) |
| Always on (no consent) | Cookieless aggregate pageviews: path, human/bot, geo from edge. **No** `ad_vid` cookie |
| After Accept | Persistent `ad_vid`, engagement events, GA4 (if configured), Vercel Analytics |
| After Reject | Stay cookieless; no GA / Vercel Analytics / engagement beacons |
| Consent cookie | `ad_consent` = `essential` \| `all` (not httpOnly so client can read; 1y) |
| Active use | Dwell heartbeats + `message_sent` + `tool_call` per agent |
| GA | Load only if `NEXT_PUBLIC_GA_MEASUREMENT_ID` set; Consent Mode v2 default denied until `all` |
| Legal page | Minimal `/privacy` linked from banner |
| Schema bootstrap | Runtime `CREATE IF NOT EXISTS` (same as page_views; no migrate-on-build) |

## Consent flow

1. First visit: no `ad_consent` → treat as essential-only; show banner.
2. Middleware / pageview API: set `ad_vid` **only** when `ad_consent=all`. Otherwise mint ephemeral `visitor_id` for the row (not stored in a cookie).
3. Accept → write `ad_consent=all`, mint/set `ad_vid`, `gtag('consent','update',{analytics_storage:'granted',...})`, enable engagement tracker.
4. Reject → write `ad_consent=essential`; clear any prior `ad_vid` if present; keep essential pageviews only.

## Data

### `page_views` (existing)

Unchanged columns. Without consent, `visitor_id` is ephemeral UUID per hit (dedupe within 5s still works for same request bursts if client reuses the id for soft nav within session memory — optional; default ephemeral per ingest is fine for aggregates).

### `engagement_events` (new)

| Column | Notes |
|---|---|
| id | uuid PK |
| created_at | timestamptz |
| visitor_id | text (requires consent / ad_vid) |
| user_id | text nullable |
| agent_slug | text nullable |
| event_type | `agent_open` \| `message_sent` \| `tool_call` \| `heartbeat` |
| path | text |
| session_key | text (client chat session id) |
| duration_ms | int nullable (heartbeat active ms since last beat) |
| metadata | text/json nullable |

Ingest: `POST /api/analytics/engagement` — rejects unless `ad_consent=all`.

### `/analytics` additions

- Top agents by `message_sent` (and optional active time from heartbeats)
- Keep existing visits / countries / bots as-is on whatever is merged

## GA4 hook

- `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-…` in env
- Script in layout: Consent Mode defaults `denied`; on Accept → `granted`
- Custom events mirrored lightly: `agent_message`, `agent_open` (optional parity with Neon)
- If env empty: no Google scripts

## Out of scope

- Full legal review / DPA
- IP-based geo consent variance (same rules for all visitors)
- Migrating historical page_views visitor_ids
