/**
 * Google Maps Embed API helpers, shared by MapsEmbed (grounding captures) and
 * GuideMap's fallback when no Maps JavaScript API key is configured.
 */

/**
 * Legacy place IDs ("ChIJ…", "Ei…", "Gh…") work as `place_id:<id>`. Gemini
 * grounding often returns Places v2 IDs ("places/<id>"), which the Embed API
 * rejects.
 */
export function isLegacyPlaceId(id: string | null | undefined): id is string {
  return !!id && /^(ChIJ|Ei|Gh)[\w-]{10,}$/.test(id);
}

/** The Embed `q` for a place: its legacy ID, else "name, address", else null. */
export function embedQuery(place: {
  placeId?: string | null;
  name?: string | null;
  address?: string | null;
}): string | null {
  if (isLegacyPlaceId(place.placeId)) return `place_id:${place.placeId}`;
  const text = [place.name, place.address]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ');
  return text || null;
}

export function embedSrc(key: string, q: string, context?: string | null): string {
  const src = new URL('https://www.google.com/maps/embed/v1/place');
  src.searchParams.set('key', key);
  src.searchParams.set('q', q);
  if (context) src.searchParams.set('context', context);
  return src.toString();
}
