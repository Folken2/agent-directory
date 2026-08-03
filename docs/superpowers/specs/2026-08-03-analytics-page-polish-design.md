# Analytics page polish — design

## Goal

Make public `/analytics` feel professional and inviting, while adding a private ops view for the owner.

## Audience

| Surface | Who | Purpose |
|---------|-----|---------|
| `/analytics` | Public | Showcase visits + top agents; invite try via agent pages |
| `/analytics/ops` | `folkenai21@gmail.com` only | Denser same-data view; room for future ops metrics |

## Public `/analytics`

### Layout

1. Header — title + one supporting line
2. Pulse strip — large total visits; human % and bot count beside (not a lone centered card)
3. Timeline — 30-day chart with range control
4. Agents people use — compact mini-cards (not slug rank rows)
5. Two columns — Top countries | Crawlers by company

Stay within existing MD design tokens / max width. No new theme.

### Timeline ranges

Segmented control: **30 days · 90 days · All time** (default **30**).

- Pulse totals remain **all recorded visits**
- Only the chart (and its “in period” total) changes with the selected range
- API: `GET /api/analytics/stats?range=30|90|all`

### Agent mini-cards

- Logo + **displayName** (catalog / `formatAgentDisplayName`; never raw slug as primary)
- Meta: `N msgs · Xm active`
- Whole card links to `/agents/[name]`
- No star control
- Empty copy unchanged in meaning when no consented engagement

## Ops `/analytics/ops`

- Server gate: signed-in email must match allowlist (`ANALYTICS_OPS_EMAILS`, default `folkenai21@gmail.com`). Others → **404**.
- Quiet “Ops” link on public `/analytics` only when session email matches (UI hint; server still enforces).
- v1: denser twin — full `byBot` list, timeline ranges, engagement as table. No new metrics yet.

## Out of scope

- Consent-rate / GA embeds / funnels
- Locking down public aggregate stats API
- Homepage visits pill behavior beyond linking here

## Decisions

- Approach: separate ops route (not gated section on public page)
- Agent CTA: `/agents/[name]` (not direct chat)
- Public includes crawlers (option B)
