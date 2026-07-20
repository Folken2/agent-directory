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
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) return null;

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

/**
 * Resolves the message `content` + `guideDocument` pair from a full response
 * string, used by every commit path (stream-done, stop/abort, and the
 * non-streaming fallback) so they can't drift apart. Prefers an
 * already-known `guideDocument` (e.g. from a `guideDocument` stream event)
 * over re-parsing the ```guidejson``` fence, but always strips the fence out
 * of the displayed text when a document is present.
 */
export function resolveGuideMessageContent(
  fullResponse: string,
  existingGuideDocument?: GuideDocument | null,
): { content: string; guideDocument: GuideDocument | undefined } {
  const fenced = extractGuideFence(fullResponse);
  const guideDocument = existingGuideDocument ?? fenced.document ?? undefined;
  const content = guideDocument ? fenced.displayText || guideDocument.lead : fullResponse;
  return { content, guideDocument };
}
