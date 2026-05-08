'use client';

import { MapsCapture } from '@/lib/types';

const MAPS_EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

interface MapsEmbedProps {
  capture: MapsCapture;
}

export function MapsEmbed({ capture }: MapsEmbedProps) {
  if (!MAPS_EMBED_KEY) return null;

  // Pick the best `q` for the Embed API.
  // - Legacy place IDs (start with "ChIJ" or "Ei") work as `place_id:<id>`.
  // - Gemini grounding usually returns Places-API-v2 IDs ("places/<id>") which
  //   the Embed API rejects, so we fall back to the place title.
  const firstPlace = capture.places[0];
  if (!firstPlace) return null;

  const looksLegacyId = (id: string | null | undefined): id is string =>
    !!id && /^(ChIJ|Ei|Gh)[\w-]{10,}$/.test(id);

  const q = looksLegacyId(firstPlace.place_id)
    ? `place_id:${firstPlace.place_id}`
    : firstPlace.title || null;

  if (!q) return null;

  const src = new URL('https://www.google.com/maps/embed/v1/place');
  src.searchParams.set('key', MAPS_EMBED_KEY);
  src.searchParams.set('q', q);
  if (capture.token) {
    src.searchParams.set('context', capture.token);
  }

  const title = firstPlace.title || 'Google Maps';

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-zinc-800">
      <iframe
        src={src.toString()}
        width="100%"
        height="360"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        title={title}
      />
    </div>
  );
}
