# Local Guide — Place Model & Single Overview Map

**Date:** 2026-07-20  
**Status:** Approved for planning  
**Scope:** Replace Local Guide’s essay-then-N-iframes UX with a first-class `GuideDocument`, PlaceCards, and **one** multi-marker map. Adaptive layouts by answer shape; ship neighborhood first.

## Problem

Local Guide (`google_explorer_agent`) today has two disconnected channels:

1. **Narrative** — coordinator markdown with emoji place blocks (address / rating / hours).
2. **Spatial** — `maps:captures` rendered as stacked Google Maps Embed iframes **after** the full answer, using only `places[0]` per capture.

Reading order ≠ place order ≠ map order. Users scroll past Day 1 / Day 2 / Sources into a pile of maps that are not tied to the places they just read. Multi-place answers amplify this (N captures → N iframes). Maps also vanish while streaming and on session resume (text-only hydration).

## Goals

- Make **places first-class**: one `GuidePlace` identity shared by card, list order, and map marker.
- Prefer **one interactive map** for the whole answer (all relevant places as markers), not N embeds.
- Support adaptive layouts by `shape`: `neighborhood` | `itinerary` | `comparison` | `single`.
- Keep a short prose `lead` + web `sources`; stop dumping emoji place walls into the bubble when structure succeeds.
- Preserve a **legacy fallback** (current markdown + embeds) when no valid document is present.
- Phase delivery: neighborhood first, then itinerary / comparison / single, then resume persistence.

## Non-goals

- Routing polylines, turn-by-turn, or Street View in v1.
- In-UI itinerary editing / drag-reorder.
- Changing non-Guide agents’ message rendering.
- Replacing Google grounding / `maps:captures` token capture (keep for attribution; do not render one iframe per capture).
- Perfect pin accuracy when Embed/JS APIs reject Places API v2 IDs (title / Maps URL fallback remains acceptable).

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Approach | **Guide Document** — structured payload is the primary UI; markdown place blocks retired for Guide when valid |
| Job priority | **D** (adaptive by shape), with **B** (neighborhood) as phase-1 default |
| Data depth | **Full place model** — cards + map anchors; prose is lead/sources, not the place catalog |
| Map UX | **One JS multi-marker overview map**; Embed API only as fallback / true `single` when JS key missing |
| Emission | Prefer `guide:document` via `state_delta` (same reliability pattern as `maps:captures`); fenced JSON parse acceptable as interim |
| Fallback | Invalid/missing document → today’s markdown + stacked embeds |
| Other agents | Unchanged |

## Design

### Data model

```ts
type GuideShape = 'neighborhood' | 'itinerary' | 'comparison' | 'single';

type GuidePlace = {
  id: string;                 // stable within the turn (e.g. "p1")
  name: string;
  mapsUrl?: string;
  placeId?: string;           // from grounding when available
  address?: string;
  rating?: number;
  reviewCount?: number;
  hours?: string;
  openNow?: boolean;
  category?: string;
  summary?: string;           // one short line
  mapsCaptureIndex?: number;  // ties to maps:captures[i] for widget token / attribution
};

type GuideSection = {
  id: string;
  title: string;              // "Where to eat", "Day 1", …
  placeIds: string[];         // order matters (especially itinerary)
  blurb?: string;             // optional 1–2 sentences
};

type GuideDocument = {
  shape: GuideShape;
  lead: string;               // direct answer; no place dumps
  sections: GuideSection[];
  places: GuidePlace[];
  sources?: { title: string; url: string }[];  // web only, ~top 4
};
```

**Shape selection (coordinator):**

| Shape | When |
|--------|------|
| `neighborhood` | Many places in an area; no day order — **default / phase 1** |
| `itinerary` | Time-ordered stops or days |
| `comparison` | 3+ places on shared dimensions |
| `single` | One place deep-dive (optional runners-up as secondary) |

### One map, many places

- Default UI mounts **one** `GuideMap` (Maps JavaScript API): markers for visible places, `fitBounds`, click marker ↔ select PlaceCard.
- Do **not** stack one Embed iframe per `maps:captures` entry for Guide answers that have a valid document.
- `maps:captures` remains the source of grounding tokens / place chunks; merge onto `GuidePlace` via `placeId`, title, or `mapsCaptureIndex`.
- Attribution (P1 default): overview map via JS API + each PlaceCard links out with `mapsUrl`. If Google requires the grounding `context` token on an Embed iframe, show **at most one** Embed for the **currently selected** place (detail), never an N-stack under the essay. Exact token attachment is fixed in the implementation plan against current Maps grounding docs.
- Env: document a JS Maps key (e.g. `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY`). If missing: list + external Maps links, and/or single Embed for focused/`single` place.

### Layout by shape

| Shape | Map | List |
|--------|-----|------|
| **neighborhood** (P1) | Overview; all section places as markers | Scannable PlaceCards by section |
| **itinerary** (P2) | Same map; focus/filter by active day or stop | Day sections → ordered stop cards |
| **comparison** (P3) | One map; compared places as markers | Compact cards or table |
| **single** (P3) | Focused map (JS or Embed) | One rich PlaceCard |

**Phase-1 composition (neighborhood):**  
`lead` → `GuideMap` → `GuideSection`s of `PlaceCard`s → `GuideSources`.

Desktop: map sticky beside list when width allows. Mobile: map on top, list below. Selected place: card highlighted + map pans/zooms to marker. Card action: “Open in Google Maps” via `mapsUrl`.

### Agent pipeline

1. Specialists run as today (`web_search_specialist`, `maps_specialist`).
2. Existing `capture_maps_widget_token` callback still writes `maps:captures`.
3. Coordinator synthesizes **one** `GuideDocument` (owns `shape`, sections, places, lead, sources).
4. Emit document to the client via preferred `state_delta['guide:document']` (reassign for ADK tracking, same lesson as maps captures). Streamable `lead` text may accompany it.
5. UI validates; on failure, legacy path.

**Prompt contract:**

- Coordinator: choose `shape`; fill structured places/sections; `lead` = direct answer only; sources = web URLs only; **no** user-visible per-place emoji markdown walls when emitting a document.
- Maps specialist: prefer typed fields the coordinator can copy into `GuidePlace` (name, address, rating, hours, maps URL, place id when present).

### Frontend components

Guide-only when `message.guideDocument` (or equivalent) is present:

| Component | Role |
|-----------|------|
| `GuideAnswer` | Shape switcher |
| `GuideMap` | One JS map; markers; selection sync; `fitBounds` |
| `PlaceCard` | Place fields from `GuidePlace`; click selects |
| `GuideSection` | Title, optional blurb, ordered cards |
| `GuideSources` | Compact web links |
| Legacy | `MarkdownRenderer` + stacked `MapsEmbed` |

Other agents and tool-status chrome stay as they are (demoted subagent / hierarchical tools prefs still apply).

### Streaming

- v1: show `lead` (+ tool progress) while running; mount cards + map when the document is complete.
- Progressive partial JSON streaming is optional later, not required for P1.

### Persistence / resume

- Target: persist `guideDocument` (and needed token refs) with the message/session so resume is not text-only.
- Until wired (P4): live turns get the new UI; old resumed sessions keep legacy text.

## Phasing

1. **P1 — Neighborhood:** schema, coordinator emit, merge with `maps:captures`, `GuideAnswer` / `GuideMap` / `PlaceCard`, legacy fallback.
2. **P2 — Itinerary:** day sections; map focus/filter by day or stop.
3. **P3 — Comparison + single:** compact compare layout; single focused card + map.
4. **P4 — Resume/hydration** of structured guide on session reload.

## Success criteria

For a typical “what’s around X” answer:

- User sees **one map with all places** and scannable cards tied to markers.
- Short lead; no essay-then-N-iframes for successful structured answers.
- Invalid structure never hard-breaks Guide (legacy path works).

## Testing (planning-level)

- Fixture `GuideDocument` (neighborhood) renders one map + N cards; selection syncs marker ↔ card.
- Missing JS key degrades without crashing.
- Missing/invalid document uses legacy markdown + embeds.
- Coordinator/prompt eval or golden: structured emit for a sample neighborhood query (implementation plan to specify harness).

## Out of scope follow-ups

- Multi-stop routing overlays.
- Richer map modes (heatmap, categories filters).
- Server-side validation service beyond light client checks.
- Sharing a standalone “guide page” outside chat.
