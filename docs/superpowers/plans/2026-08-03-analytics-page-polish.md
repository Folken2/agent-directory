# Analytics page polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or implement directly in-session). Steps use TDD where practical.

**Goal:** Polish public `/analytics`, add timeline ranges, agent mini-cards, and allowlisted `/analytics/ops`.

**Tech:** Next.js App Router, existing `getPageviewStats` / Neon, NextAuth `auth()`, MD tokens.

## File map

| File | Role |
|------|------|
| `lib/analytics/timeline-range.ts` | Parse/validate `30` \| `90` \| `all` |
| `lib/analytics/ops-access.ts` | Email allowlist helper |
| `lib/analytics/stats.ts` | Range-aware timeline; all-time topAgents |
| `app/api/analytics/stats/route.ts` | `?range=` |
| `lib/analytics/fetch-stats-client.ts` + `use-pageview-stats.ts` | Pass range |
| `components/analytics/VisitsTimeline.tsx` | Range segmented control |
| `components/analytics/AnalyticsAgentCard.tsx` | Mini card |
| `components/analytics/AnalyticsPreview.tsx` | Public layout redesign |
| `app/analytics/page.tsx` | Ops link when allowed |
| `app/analytics/ops/page.tsx` | Gated ops UI |
| `adk-web-ui/env.example` | `ANALYTICS_OPS_EMAILS` |

## Tasks

### Task 1: Timeline range in stats API

- Add `TimelineRange`, `parseTimelineRange`
- `getPageviewStats(range)` with cache key including range
- Timeline query uses 30 / 90 / all (all = from earliest day)
- `topAgents` without timeline `since` filter (all-time engagement)
- Route reads `searchParams.range`

### Task 2: Client range + timeline UI

- Hook/fetch accept range; refetch on change
- Segmented control on timeline

### Task 3: Public polish + mini-cards

- Pulse strip layout
- `AnalyticsAgentCard` + resolve displayName/logo via `/api/agents` map
- Link to `/agents/[slug]`

### Task 4: Ops route

- `isAnalyticsOpsEmail` + server `notFound()`
- Ops page denser tables + same timeline
- Conditional Ops link on public page

### Task 5: Verify

- Unit test parse range + ops email
- Manual/typecheck as available
