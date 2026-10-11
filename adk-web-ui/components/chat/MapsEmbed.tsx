'use client';

import { MapsCapture } from '@/lib/types';
import { embedQuery, embedSrc } from '@/lib/maps/embed';

export const MAPS_EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

interface MapsEmbedProps {
  capture: MapsCapture;
}

export function EmbedFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-zinc-800">
      <iframe
        src={src}
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

export function MapsEmbed({ capture }: MapsEmbedProps) {
  if (!MAPS_EMBED_KEY) return null;

  const firstPlace = capture.places[0];
  if (!firstPlace) return null;

  const q = embedQuery({ placeId: firstPlace.place_id, name: firstPlace.title });
  if (!q) return null;

  return (
    <EmbedFrame
      src={embedSrc(MAPS_EMBED_KEY, q, capture.token)}
      title={firstPlace.title || 'Google Maps'}
    />
  );
}
