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
