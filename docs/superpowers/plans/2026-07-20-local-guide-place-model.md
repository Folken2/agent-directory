# Local Guide Place Model (P1 Neighborhood) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Local Guide neighborhood answers as a `GuideDocument` with PlaceCards and **one** multi-marker map (no N-iframe stack), with legacy markdown+embeds fallback.

**Architecture:** Coordinator emits structured JSON; an after-model callback writes `guide:document` into ADK `state_delta` (same pattern as `maps:captures`). The UI validates, merges grounding captures onto places, and renders `GuideAnswer` (lead → one `GuideMap` → sections of `PlaceCard`s → sources). Invalid/missing documents keep today’s MessageBubble path.

**Tech Stack:** Next.js 16, React 19, `@vis.gl/react-google-maps`, existing ADK SSE/`state_delta` streaming, node:test unit tests, Python ADK callbacks on `google_explorer_agent`.

**Spec:** `docs/superpowers/specs/2026-07-20-local-guide-place-model-design.md`

## Global Constraints

- P1 shape only: render `neighborhood` (and treat unknown/`itinerary`/`comparison`/`single` with the same neighborhood layout until later plans — do not build day filters yet).
- One map widget per Guide answer; never stack N `MapsEmbed` when a valid `guideDocument` is present.
- Other agents unchanged.
- No secrets in repo; document `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY` in `env.example`.
- Prefer reassigning ADK state lists/dicts (in-place mutation does not appear in `state_delta`).
- Max 12 bullets style does not apply here; keep Guide UI quiet (no large promotional chrome).

**Deferred (separate plans):** P2 itinerary focus, P3 comparison/single layouts, P4 session resume hydration of `guideDocument`.

---

## File map

| File | Responsibility |
|------|----------------|
| `adk-web-ui/lib/guide/types.ts` | `GuideDocument` / `GuidePlace` / `GuideSection` types |
| `adk-web-ui/lib/guide/parse.ts` | Parse/validate document; strip fenced JSON from assistant text |
| `adk-web-ui/lib/guide/merge.ts` | Merge `maps:captures` onto places |
| `adk-web-ui/lib/guide/*.test.ts` | Unit tests |
| `adk-web-ui/components/chat/guide/PlaceCard.tsx` | Single place card |
| `adk-web-ui/components/chat/guide/GuideSection.tsx` | Section title + cards |
| `adk-web-ui/components/chat/guide/GuideSources.tsx` | Web sources list |
| `adk-web-ui/components/chat/guide/GuideMap.tsx` | One JS multi-marker map |
| `adk-web-ui/components/chat/guide/GuideAnswer.tsx` | Neighborhood composition + selection state |
| `adk-web-ui/components/chat/MessageBubble.tsx` | Branch: GuideAnswer vs legacy |
| `adk-web-ui/lib/types.ts` | `Message.guideDocument`, `StreamChunk` guide variant |
| `adk-web-ui/lib/adk-client.ts` | Yield `guideDocument` from `state_delta` |
| `adk-web-ui/lib/hooks/useStreamingChat.ts` | Attach document to committed message |
| `adk-web-ui/env.example` + README | JS Maps key docs |
| `agents/google_explorer_agent/prompt/prompt.py` | Coordinator (+ maps specialist) prompt for structured emit |
| `agents/google_explorer_agent/callbacks/guide_document.py` | Parse JSON → `guide:document` state; strip fence from parts |
| `agents/google_explorer_agent/agent.py` | Wire callback list on coordinator |
| `agents/google_explorer_agent/README.md` | Document new state key + UI contract |

---

### Task 1: Guide types, parse/validate, strip fence

**Files:**
- Create: `adk-web-ui/lib/guide/types.ts`
- Create: `adk-web-ui/lib/guide/parse.ts`
- Create: `adk-web-ui/lib/guide/parse.test.ts`
- Modify: `adk-web-ui/package.json` (`test:unit` glob to include `lib/guide/**/*.test.ts`)

**Interfaces:**
- Produces: `GuideShape`, `GuidePlace`, `GuideSection`, `GuideDocument`, `parseGuideDocument(raw: unknown): GuideDocument | null`, `extractGuideFence(text: string): { document: GuideDocument | null; displayText: string }`

- [ ] **Step 1: Write failing unit tests**

```ts
// adk-web-ui/lib/guide/parse.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGuideDocument, extractGuideFence } from './parse.ts';

const valid = {
  shape: 'neighborhood',
  lead: 'Gràcia is great for cafés.',
  sections: [{ id: 's1', title: 'Cafés', placeIds: ['p1'] }],
  places: [{ id: 'p1', name: 'Café Cometa', address: 'Carrer x', rating: 4.6, summary: 'Quiet specialty coffee.' }],
  sources: [{ title: 'Timeout', url: 'https://example.com' }],
};

describe('parseGuideDocument', () => {
  it('accepts a valid neighborhood document', () => {
    const doc = parseGuideDocument(valid);
    assert.ok(doc);
    assert.equal(doc!.places[0].name, 'Café Cometa');
  });

  it('rejects missing places', () => {
    assert.equal(parseGuideDocument({ ...valid, places: [] }), null);
  });

  it('rejects unknown shape', () => {
    assert.equal(parseGuideDocument({ ...valid, shape: 'nope' }), null);
  });

  it('rejects section placeIds that do not exist', () => {
    assert.equal(
      parseGuideDocument({
        ...valid,
        sections: [{ id: 's1', title: 'X', placeIds: ['missing'] }],
      }),
      null,
    );
  });
});

describe('extractGuideFence', () => {
  it('parses ```guidejson fence and returns lead-only display text', () => {
    const text = `Gràcia is great for cafés.\n\n\`\`\`guidejson\n${JSON.stringify(valid)}\n\`\`\`\n`;
    const { document, displayText } = extractGuideFence(text);
    assert.ok(document);
    assert.equal(document!.shape, 'neighborhood');
    assert.match(displayText, /Gràcia/);
    assert.doesNotMatch(displayText, /guidejson/);
  });

  it('returns null document when fence missing', () => {
    const { document, displayText } = extractGuideFence('Just prose');
    assert.equal(document, null);
    assert.equal(displayText, 'Just prose');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd adk-web-ui && node --import tsx --test lib/guide/parse.test.ts
```

Expected: cannot find module `./parse.ts` (or similar)

- [ ] **Step 3: Implement types + parse**

```ts
// adk-web-ui/lib/guide/types.ts
export type GuideShape = 'neighborhood' | 'itinerary' | 'comparison' | 'single';

export type GuidePlace = {
  id: string;
  name: string;
  mapsUrl?: string;
  placeId?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  hours?: string;
  openNow?: boolean;
  category?: string;
  summary?: string;
  mapsCaptureIndex?: number;
  lat?: number;
  lng?: number;
};

export type GuideSection = {
  id: string;
  title: string;
  placeIds: string[];
  blurb?: string;
};

export type GuideDocument = {
  shape: GuideShape;
  lead: string;
  sections: GuideSection[];
  places: GuidePlace[];
  sources?: { title: string; url: string }[];
};
```

```ts
// adk-web-ui/lib/guide/parse.ts
import type { GuideDocument, GuidePlace, GuideSection, GuideShape } from './types';

const SHAPES = new Set<GuideShape>(['neighborhood', 'itinerary', 'comparison', 'single']);
const FENCE_RE = /```guidejson\s*([\s\S]*?)```/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parsePlace(raw: unknown): GuidePlace | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  const place: GuidePlace = { id: raw.id, name: raw.name };
  if (typeof raw.mapsUrl === 'string') place.mapsUrl = raw.mapsUrl;
  if (typeof raw.placeId === 'string') place.placeId = raw.placeId;
  if (typeof raw.address === 'string') place.address = raw.address;
  if (typeof raw.rating === 'number') place.rating = raw.rating;
  if (typeof raw.reviewCount === 'number') place.reviewCount = raw.reviewCount;
  if (typeof raw.hours === 'string') place.hours = raw.hours;
  if (typeof raw.openNow === 'boolean') place.openNow = raw.openNow;
  if (typeof raw.category === 'string') place.category = raw.category;
  if (typeof raw.summary === 'string') place.summary = raw.summary;
  if (typeof raw.mapsCaptureIndex === 'number') place.mapsCaptureIndex = raw.mapsCaptureIndex;
  if (typeof raw.lat === 'number') place.lat = raw.lat;
  if (typeof raw.lng === 'number') place.lng = raw.lng;
  return place;
}

export function parseGuideDocument(raw: unknown): GuideDocument | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.shape !== 'string' || !SHAPES.has(raw.shape as GuideShape)) return null;
  if (typeof raw.lead !== 'string') return null;
  if (!Array.isArray(raw.places) || raw.places.length === 0) return null;
  if (!Array.isArray(raw.sections)) return null;

  const places: GuidePlace[] = [];
  for (const p of raw.places) {
    const place = parsePlace(p);
    if (!place) return null;
    places.push(place);
  }
  const placeIds = new Set(places.map((p) => p.id));

  const sections: GuideSection[] = [];
  for (const s of raw.sections) {
    if (!isRecord(s) || typeof s.id !== 'string' || typeof s.title !== 'string') return null;
    if (!Array.isArray(s.placeIds) || !s.placeIds.every((id) => typeof id === 'string' && placeIds.has(id))) {
      return null;
    }
    const section: GuideSection = { id: s.id, title: s.title, placeIds: s.placeIds as string[] };
    if (typeof s.blurb === 'string') section.blurb = s.blurb;
    sections.push(section);
  }

  const doc: GuideDocument = {
    shape: raw.shape as GuideShape,
    lead: raw.lead,
    sections,
    places,
  };

  if (Array.isArray(raw.sources)) {
    const sources: { title: string; url: string }[] = [];
    for (const src of raw.sources) {
      if (!isRecord(src) || typeof src.title !== 'string' || typeof src.url !== 'string') return null;
      sources.push({ title: src.title, url: src.url });
    }
    doc.sources = sources;
  }

  return doc;
}

export function extractGuideFence(text: string): { document: GuideDocument | null; displayText: string } {
  const match = text.match(FENCE_RE);
  if (!match) return { document: null, displayText: text };
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1]!.trim());
  } catch {
    return { document: null, displayText: text };
  }
  const document = parseGuideDocument(parsed);
  const displayText = text.replace(FENCE_RE, '').trim();
  return { document, displayText };
}
```

Update `package.json` `test:unit` script to:

```json
"test:unit": "node --import tsx --test lib/analytics/**/*.test.ts lib/agent-catalog.test.ts lib/guide/**/*.test.ts"
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd adk-web-ui && npm run test:unit
```

- [ ] **Step 5: Commit**

```bash
git add adk-web-ui/lib/guide adk-web-ui/package.json
git commit -m "feat(guide): add GuideDocument parse and validate helpers"
```

---

### Task 2: Merge maps captures onto places

**Files:**
- Create: `adk-web-ui/lib/guide/merge.ts`
- Create: `adk-web-ui/lib/guide/merge.test.ts`

**Interfaces:**
- Consumes: `GuideDocument`, `MapsCapture` from `@/lib/types`
- Produces: `mergeGuideWithCaptures(doc: GuideDocument, captures: MapsCapture[]): GuideDocument`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeGuideWithCaptures } from './merge.ts';
import type { GuideDocument } from './types.ts';

const doc: GuideDocument = {
  shape: 'neighborhood',
  lead: 'Hi',
  sections: [{ id: 's1', title: 'Cafés', placeIds: ['p1', 'p2'] }],
  places: [
    { id: 'p1', name: 'Café Cometa' },
    { id: 'p2', name: 'Other', mapsCaptureIndex: 1 },
  ],
};

describe('mergeGuideWithCaptures', () => {
  it('fills placeId/mapsUrl from title match', () => {
    const merged = mergeGuideWithCaptures(doc, [
      {
        token: 'tok0',
        captured_at: 't0',
        places: [{ place_id: 'ChIJabc', title: 'Café Cometa', uri: 'https://maps.google.com/?cid=1' }],
      },
    ]);
    assert.equal(merged.places[0].placeId, 'ChIJabc');
    assert.equal(merged.places[0].mapsUrl, 'https://maps.google.com/?cid=1');
    assert.equal(merged.places[0].mapsCaptureIndex, 0);
  });

  it('honors explicit mapsCaptureIndex', () => {
    const merged = mergeGuideWithCaptures(doc, [
      { token: 'a', captured_at: 't0', places: [{ place_id: 'x', title: 'Nope', uri: null }] },
      {
        token: 'b',
        captured_at: 't1',
        places: [{ place_id: 'ChIJother', title: 'Other', uri: 'https://maps.google.com/?cid=2' }],
      },
    ]);
    assert.equal(merged.places[1].placeId, 'ChIJother');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd adk-web-ui && node --import tsx --test lib/guide/merge.test.ts
```

- [ ] **Step 3: Implement merge**

```ts
// adk-web-ui/lib/guide/merge.ts
import type { MapsCapture } from '@/lib/types';
import type { GuideDocument, GuidePlace } from './types';

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function enrichPlace(place: GuidePlace, captures: MapsCapture[]): GuidePlace {
  if (typeof place.mapsCaptureIndex === 'number' && captures[place.mapsCaptureIndex]) {
    const cap = captures[place.mapsCaptureIndex]!;
    const hit =
      cap.places.find((p) => p.title && norm(p.title) === norm(place.name)) ?? cap.places[0];
    if (!hit) return place;
    return {
      ...place,
      placeId: place.placeId ?? hit.place_id ?? undefined,
      mapsUrl: place.mapsUrl ?? hit.uri ?? undefined,
    };
  }

  for (let i = 0; i < captures.length; i++) {
    const cap = captures[i]!;
    const hit = cap.places.find((p) => p.title && norm(p.title) === norm(place.name));
    if (!hit) continue;
    return {
      ...place,
      placeId: place.placeId ?? hit.place_id ?? undefined,
      mapsUrl: place.mapsUrl ?? hit.uri ?? undefined,
      mapsCaptureIndex: place.mapsCaptureIndex ?? i,
    };
  }
  return place;
}

export function mergeGuideWithCaptures(doc: GuideDocument, captures: MapsCapture[]): GuideDocument {
  if (!captures.length) return doc;
  return { ...doc, places: doc.places.map((p) => enrichPlace(p, captures)) };
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd adk-web-ui && node --import tsx --test lib/guide/merge.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add adk-web-ui/lib/guide/merge.ts adk-web-ui/lib/guide/merge.test.ts
git commit -m "feat(guide): merge maps captures onto GuidePlace fields"
```

---

### Task 3: PlaceCard, GuideSection, GuideSources, GuideAnswer (no map yet)

**Files:**
- Create: `adk-web-ui/components/chat/guide/PlaceCard.tsx`
- Create: `adk-web-ui/components/chat/guide/GuideSection.tsx`
- Create: `adk-web-ui/components/chat/guide/GuideSources.tsx`
- Create: `adk-web-ui/components/chat/guide/GuideAnswer.tsx`

**Interfaces:**
- Consumes: `GuideDocument`, selection `selectedPlaceId: string | null`, `onSelectPlace(id: string)`
- Produces: rendered neighborhood layout; map slot as optional `map` prop for Task 4

- [ ] **Step 1: Implement PlaceCard**

```tsx
// adk-web-ui/components/chat/guide/PlaceCard.tsx
'use client';

import { cn } from '@/lib/utils';
import type { GuidePlace } from '@/lib/guide/types';

type Props = {
  place: GuidePlace;
  selected: boolean;
  onSelect: () => void;
};

export function PlaceCard({ place, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
        selected ? 'border-foreground/40 bg-muted/50' : 'border-border/60 hover:bg-muted/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-[15px] text-foreground">{place.name}</div>
          {place.category && (
            <div className="text-xs text-muted-foreground mt-0.5">{place.category}</div>
          )}
        </div>
        {typeof place.rating === 'number' && (
          <div className="text-xs text-muted-foreground shrink-0">★ {place.rating.toFixed(1)}</div>
        )}
      </div>
      {place.summary && <p className="mt-1.5 text-sm text-foreground/80">{place.summary}</p>}
      <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        {place.address && <div>{place.address}</div>}
        {place.hours && <div>{place.hours}</div>}
      </div>
      {place.mapsUrl && (
        <a
          href={place.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-xs text-foreground/70 underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open in Google Maps
        </a>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Implement GuideSection + GuideSources + GuideAnswer**

```tsx
// GuideSection.tsx — maps placeIds → PlaceCard list with title/blurb
// GuideSources.tsx — ul of external links
// GuideAnswer.tsx — useState selectedPlaceId; lead as prose; sections; sources;
//   accept optional mapSlot: ReactNode rendered after lead
```

`GuideAnswer` sketch:

```tsx
'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { GuideDocument } from '@/lib/guide/types';
import { GuideSectionList } from './GuideSection';
import { GuideSources } from './GuideSources';

type Props = {
  document: GuideDocument;
  mapSlot?: (ctx: {
    places: GuideDocument['places'];
    selectedPlaceId: string | null;
    onSelectPlace: (id: string) => void;
  }) => ReactNode;
};

export function GuideAnswer({ document, mapSlot }: Props) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    document.places[0]?.id ?? null,
  );
  const placeById = useMemo(
    () => new Map(document.places.map((p) => [p.id, p])),
    [document.places],
  );

  return (
    <div className="space-y-4">
      <p className="text-[15px] leading-relaxed text-foreground">{document.lead}</p>
      {mapSlot?.({
        places: document.places,
        selectedPlaceId,
        onSelectPlace: setSelectedPlaceId,
      })}
      <div className="space-y-5">
        {document.sections.map((section) => (
          <GuideSectionList
            key={section.id}
            section={section}
            placeById={placeById}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
          />
        ))}
      </div>
      {document.sources && document.sources.length > 0 && (
        <GuideSources sources={document.sources} />
      )}
    </div>
  );
}
```

Implement `GuideSectionList` / `GuideSources` to match the card styling above (quiet borders, no heavy chrome).

- [ ] **Step 3: Smoke-check in Story-less way** — temporarily import `GuideAnswer` with a fixture in a throwaway page OR rely on Task 5 MessageBubble wiring. Prefer wiring in Task 5; here just ensure TypeScript builds:

```bash
cd adk-web-ui && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add adk-web-ui/components/chat/guide
git commit -m "feat(guide): add PlaceCard and GuideAnswer shell"
```

---

### Task 4: GuideMap (one multi-marker map)

**Files:**
- Create: `adk-web-ui/components/chat/guide/GuideMap.tsx`
- Modify: `adk-web-ui/package.json` — add `@vis.gl/react-google-maps`
- Modify: `adk-web-ui/env.example`
- Modify: `adk-web-ui/README.md` (Maps JS key note)

**Interfaces:**
- Consumes: `places: GuidePlace[]`, `selectedPlaceId`, `onSelectPlace`
- Behavior: if no `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY`, render nothing (cards + Maps links still work). Geocode places missing `lat`/`lng` via `google.maps.Geocoder` using `address || name`.

- [ ] **Step 1: Install dependency**

```bash
cd adk-web-ui && npm install @vis.gl/react-google-maps
```

- [ ] **Step 2: Implement GuideMap**

Use `APIProvider` + `Map` + `AdvancedMarker` (or `Marker`) from `@vis.gl/react-google-maps`.

Required behavior:
1. On mount / places change: for each place without lat/lng, geocode once; skip failures.
2. When ≥1 positioned place: `fitBounds` with padding.
3. Marker click → `onSelectPlace(id)`.
4. When `selectedPlaceId` changes and that place has coords → `panTo` + gentle zoom.
5. Height ~280–320px; rounded border matching chat chrome (`border-border`, `rounded-lg`, `overflow-hidden`).

Skeleton:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { GuidePlace } from '@/lib/guide/types';

const JS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;

type Props = {
  places: GuidePlace[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
};

type Positioned = GuidePlace & { lat: number; lng: number };

function FitBounds({ places }: { places: Positioned[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || places.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    places.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 48);
  }, [map, places]);
  return null;
}

export function GuideMap(props: Props) {
  if (!JS_KEY) return null;
  return (
    <APIProvider apiKey={JS_KEY}>
      <GuideMapInner {...props} />
    </APIProvider>
  );
}

// GuideMapInner: geocode effect, Map defaultCenter={first|BCN fallback}, markers, FitBounds, selection pan
```

- [ ] **Step 3: Document env**

In `adk-web-ui/env.example`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY=
# Maps JavaScript API — Local Guide multi-marker overview (restrict by HTTP referrer)
NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY=
```

Update `adk-web-ui/README.md` Maps section: Embed = legacy/single fallback; JS key = Guide overview map.

- [ ] **Step 4: Typecheck**

```bash
cd adk-web-ui && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add adk-web-ui/components/chat/guide/GuideMap.tsx adk-web-ui/package.json adk-web-ui/package-lock.json adk-web-ui/env.example adk-web-ui/README.md
git commit -m "feat(guide): add multi-marker GuideMap via Maps JS API"
```

---

### Task 5: Wire MessageBubble — Guide vs legacy

**Files:**
- Modify: `adk-web-ui/lib/types.ts` — add `guideDocument?: GuideDocument` on `Message`
- Modify: `adk-web-ui/components/chat/MessageBubble.tsx`
- Modify: `adk-web-ui/components/chat/guide/GuideAnswer.tsx` — pass `GuideMap` via `mapSlot`

**Interfaces:**
- When `message.guideDocument` parses valid: render `GuideAnswer` with merged captures; **do not** render stacked `MapsEmbed`.
- Else: existing markdown + stacked embeds.

- [ ] **Step 1: Extend Message type**

```ts
import type { GuideDocument } from '@/lib/guide/types';
// on Message:
guideDocument?: GuideDocument;
```

- [ ] **Step 2: Branch in MessageBubble**

Inside the assistant bubble, after tools/thinking:

```tsx
import { GuideAnswer } from './guide/GuideAnswer';
import { GuideMap } from './guide/GuideMap';
import { mergeGuideWithCaptures } from '@/lib/guide/merge';
import { parseGuideDocument } from '@/lib/guide/parse';

const guideDoc = message.guideDocument
  ? parseGuideDocument(message.guideDocument) // re-validate
  : null;
const mergedGuide = guideDoc
  ? mergeGuideWithCaptures(guideDoc, message.mapsCaptures ?? [])
  : null;

// In render:
{mergedGuide ? (
  <GuideAnswer
    document={mergedGuide}
    mapSlot={({ places, selectedPlaceId, onSelectPlace }) => (
      <GuideMap
        places={places}
        selectedPlaceId={selectedPlaceId}
        onSelectPlace={onSelectPlace}
      />
    )}
  />
) : (
  <>
    {/* existing MarkdownRenderer + artifacts + mapsCaptures MapsEmbed stack */}
  </>
)}
```

Optional P1 detail: if `mergedGuide` and selected place has `mapsCaptureIndex` + embed key, render **one** `MapsEmbed` under the JS map for that capture only (attribution). Skip if it adds clutter; default **off** unless grounding docs require the context token on an iframe — then gate behind selected place only.

- [ ] **Step 3: Typecheck**

```bash
cd adk-web-ui && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add adk-web-ui/lib/types.ts adk-web-ui/components/chat/MessageBubble.tsx adk-web-ui/components/chat/guide
git commit -m "feat(guide): render GuideAnswer in MessageBubble with legacy fallback"
```

---

### Task 6: Stream `guide:document` from ADK client → message

**Files:**
- Modify: `adk-web-ui/lib/types.ts` — `StreamChunk` add `| { type: 'guideDocument'; guideDocument: GuideDocument; author?: string }`
- Modify: `adk-web-ui/lib/adk-client.ts` — after maps capture block, also read `state_delta['guide:document']`
- Modify: `adk-web-ui/lib/hooks/useStreamingChat.ts` — hold `guideDocument` variable; set on committed `Message`
- Also: if final text contains a `guidejson` fence and state missed it, `extractGuideFence` as client-side backup and use `displayText` for markdown legacy path / lead

- [ ] **Step 1: Yield guide document in adk-client**

Mirror maps handling (~line 780):

```ts
const guideRaw = stateDelta?.['guide:document'];
if (guideRaw) {
  // dynamic import avoid cycles if needed — or static import parseGuideDocument
  const doc = parseGuideDocument(guideRaw);
  if (doc) {
    yield { type: 'guideDocument', guideDocument: doc, author: eventData.author };
  }
}
```

- [ ] **Step 2: Accumulate in useStreamingChat**

```ts
let guideDocument: GuideDocument | undefined;
// in loop:
} else if (chunk.type === 'guideDocument' && chunk.guideDocument) {
  guideDocument = chunk.guideDocument;
}
// when committing Message:
guideDocument,
```

Client backup after stream completes:

```ts
const fenced = extractGuideFence(fullResponse);
if (!guideDocument && fenced.document) guideDocument = fenced.document;
const contentForMessage = guideDocument ? fenced.displayText || guideDocument.lead : fullResponse;
// Prefer storing lead in content when guideDocument present so copy button copies lead
```

When `guideDocument` is set, MessageBubble shows GuideAnswer (lead inside document); `content` can be `guideDocument.lead` for copy/chrome.

- [ ] **Step 3: Typecheck + unit tests still pass**

```bash
cd adk-web-ui && npm run test:unit && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add adk-web-ui/lib/types.ts adk-web-ui/lib/adk-client.ts adk-web-ui/lib/hooks/useStreamingChat.ts
git commit -m "feat(guide): stream guide:document state_delta into chat messages"
```

---

### Task 7: Agent — emit `guide:document` via callback + prompt

**Files:**
- Create: `agents/google_explorer_agent/callbacks/guide_document.py`
- Modify: `agents/google_explorer_agent/callbacks/__init__.py`
- Modify: `agents/google_explorer_agent/agent.py` — `after_model_callback=[fix_parts, capture_guide_document]`
- Modify: `agents/google_explorer_agent/prompt/prompt.py` — new coordinator prompt version instructing `guidejson` emit
- Modify: `agents/google_explorer_agent/README.md`

**Interfaces:**
- Produces: `state['guide:document']` dict; strips ```guidejson fence from final text parts so the bubble does not show raw JSON
- Consumes: model text with fence OR entire JSON object response

- [ ] **Step 1: Implement callback**

```python
# agents/google_explorer_agent/callbacks/guide_document.py
"""Parse coordinator GuideDocument JSON into session state."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse

logger = logging.getLogger(__name__)

FENCE_RE = re.compile(r"```guidejson\s*([\s\S]*?)```", re.IGNORECASE)
SHAPES = {"neighborhood", "itinerary", "comparison", "single"}


def _validate(doc: Any) -> Optional[dict]:
    if not isinstance(doc, dict):
        return None
    if doc.get("shape") not in SHAPES:
        return None
    if not isinstance(doc.get("lead"), str):
        return None
    places = doc.get("places")
    sections = doc.get("sections")
    if not isinstance(places, list) or not places:
        return None
    if not isinstance(sections, list):
        return None
    ids = set()
    for p in places:
        if not isinstance(p, dict) or not isinstance(p.get("id"), str) or not isinstance(p.get("name"), str):
            return None
        ids.add(p["id"])
    for s in sections:
        if not isinstance(s, dict) or not isinstance(s.get("id"), str) or not isinstance(s.get("title"), str):
            return None
        pids = s.get("placeIds")
        if not isinstance(pids, list) or not all(isinstance(i, str) and i in ids for i in pids):
            return None
    return doc


def _extract_from_text(text: str) -> tuple[Optional[dict], str]:
    m = FENCE_RE.search(text)
    if not m:
        # whole-text JSON attempt
        try:
            raw = json.loads(text.strip())
            doc = _validate(raw)
            if doc:
                return doc, doc.get("lead") or ""
        except json.JSONDecodeError:
            pass
        return None, text
    try:
        raw = json.loads(m.group(1).strip())
    except json.JSONDecodeError:
        return None, text
    doc = _validate(raw)
    display = FENCE_RE.sub("", text).strip()
    return doc, display if doc else text


async def capture_guide_document(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """Only meaningful on the coordinator final answer; safe no-op otherwise."""
    try:
        if not llm_response or not llm_response.content or not llm_response.content.parts:
            return None
        # Skip if this turn is only function calls
        texts = []
        for part in llm_response.content.parts:
            t = getattr(part, "text", None)
            if isinstance(t, str) and t.strip():
                texts.append(t)
        if not texts:
            return None
        combined = "\n".join(texts)
        doc, display = _extract_from_text(combined)
        if not doc:
            return None
        callback_context.state["guide:document"] = doc
        # Rewrite parts to display text only (lead / short prose)
        if display != combined and llm_response.content.parts:
            # Keep a single text part with display; drop duplicate fences
            first = llm_response.content.parts[0]
            if hasattr(first, "text"):
                first.text = display or doc.get("lead", "")
                llm_response.content.parts = [first]
        logger.info("📘 Captured guide:document shape=%s places=%s", doc.get("shape"), len(doc.get("places") or []))
    except Exception as e:
        logger.error("Error in capture_guide_document: %s", e)
    return None
```

Wire in `agent.py`:

```python
from .callbacks import after_model_callback_fix_parts, capture_guide_document

root_agent = LlmAgent(
    ...
    after_model_callback=[
        after_model_callback_fix_parts,
        capture_guide_document,
    ],
)
```

Export from `callbacks/__init__.py`.

- [ ] **Step 2: Update coordinator prompt**

Add `coordinator_prompt_v2` (keep v1 in file for history) and point `agent.py` at v2. Key instructions:

- Choose `shape` (`neighborhood` default for area scout).
- Final user-visible text: short `lead` paragraph only (optional one-line context).
- Then a single fenced block:

````
```guidejson
{ ... GuideDocument ... }
```
````

- No emoji place walls; no `## 🔗 Sources` markdown — put sources in JSON.
- Places must include `id`, `name`, and when known `address`, `rating`, `hours`, `summary`, `mapsUrl`, `category`.
- Set `mapsCaptureIndex` when you know which maps_specialist call produced the place (0-based order of maps calls this turn).

Maps specialist: encourage returning fields easy to copy into JSON (keep blocks but add a one-line machine hint, or keep as-is for coordinator to transcribe — coordinator owns the document).

- [ ] **Step 3: Update agent README** — document `guide:document` state key + UI behavior.

- [ ] **Step 4: Commit**

```bash
git add agents/google_explorer_agent
git commit -m "feat(guide): emit guide:document from Local Guide coordinator"
```

---

### Task 8: Manual verification checklist (P1 done)

**Files:** none required (optional tiny fixture page only if live agent is hard to run)

- [ ] **Step 1: Local run**

1. Set `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY` (Maps JavaScript API + Geocoding API enabled) in `adk-web-ui/.env.local`.
2. Run ADK + UI; open Local Guide.
3. Ask: “Best cafés in Gràcia, Barcelona — give me a short neighborhood scout.”
4. Expect: short lead, **one** map with multiple markers, PlaceCards, sources; **no** stack of iframes under the answer.
5. Click card ↔ marker selection sync.
6. Force invalid JSON (temporarily break prompt) → legacy markdown+embeds still works.

- [ ] **Step 2: Unit tests green**

```bash
cd adk-web-ui && npm run test:unit
```

- [ ] **Step 3: Final commit if any fixes**

```bash
git add -A  # only guide-related fixes
git commit -m "fix(guide): polish P1 neighborhood Guide UX"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| GuideDocument model | 1 |
| One multi-marker map | 4 |
| PlaceCards + sections + sources | 3 |
| Neighborhood composition | 3–5 |
| Merge maps:captures | 2, 5 |
| state_delta emission | 6–7 |
| Prompt / no emoji walls | 7 |
| Legacy fallback | 5 |
| Env JS key | 4 |
| No N embeds when guide valid | 5 |
| Streaming lead then document | 6 |
| P2–P4 | Deferred (not in this plan) |

## Placeholder / consistency check

- Types use `placeIds` / `mapsCaptureIndex` consistently across TS and Python validator.
- `parseGuideDocument` is the single client validator; Python `_validate` mirrors required fields.
- Optional selected-place Embed is explicitly default-off in Task 5.
