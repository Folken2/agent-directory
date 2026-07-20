'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import type { GuidePlace } from '@/lib/guide/types';

const JS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;

// Barcelona — reasonable fallback center when no place is positioned yet.
const FALLBACK_CENTER = { lat: 41.3874, lng: 2.1686 };

type Props = {
  places: GuidePlace[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
};

type Positioned = GuidePlace & { lat: number; lng: number };

function hasCoords(place: GuidePlace): place is Positioned {
  return typeof place.lat === 'number' && typeof place.lng === 'number';
}

function FitBounds({ places }: { places: Positioned[] }) {
  const map = useMap();
  const key = places.map((p) => `${p.id}:${p.lat},${p.lng}`).join('|');

  useEffect(() => {
    if (!map || places.length === 0) return;
    if (places.length === 1) {
      map.setCenter({ lat: places[0].lat, lng: places[0].lng });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    places.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, 48);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

function SelectionPan({ place }: { place: Positioned | undefined }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !place) return;
    map.panTo({ lat: place.lat, lng: place.lng });
    const zoom = map.getZoom();
    if (typeof zoom === 'number' && zoom < 15) {
      map.setZoom(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, place?.id, place?.lat, place?.lng]);

  return null;
}

function GuideMapInner({ places, selectedPlaceId, onSelectPlace }: Props) {
  const geocodingLibrary = useMapsLibrary('geocoding');
  const [geocoded, setGeocoded] = useState<Record<string, { lat: number; lng: number }>>({});
  const geocodeAttemptsRef = useRef<Set<string>>(new Set());
  const geocodeInFlightRef = useRef<Set<string>>(new Set());
  // Per-place-id generation token: a result/error/finally only "counts" if it
  // still matches the token issued for the latest request for that id. This
  // stops a stale (cancelled) request from clobbering state a newer request
  // for the same id currently owns.
  const geocodeTokensRef = useRef<globalThis.Map<string, number>>(new globalThis.Map());

  useEffect(() => {
    if (!geocodingLibrary) return;

    const toGeocode = places.filter(
      (p) =>
        !hasCoords(p) &&
        !geocoded[p.id] &&
        !geocodeAttemptsRef.current.has(p.id) &&
        !geocodeInFlightRef.current.has(p.id),
    );
    if (toGeocode.length === 0) return;

    const geocoder = new geocodingLibrary.Geocoder();

    toGeocode.forEach((place) => {
      const query = place.address || place.name;
      if (!query) {
        geocodeAttemptsRef.current.add(place.id);
        return;
      }
      const token = (geocodeTokensRef.current.get(place.id) ?? 0) + 1;
      geocodeTokensRef.current.set(place.id, token);
      geocodeInFlightRef.current.add(place.id);
      const isCurrent = () => geocodeTokensRef.current.get(place.id) === token;

      geocoder
        .geocode({ address: query })
        .then((result) => {
          if (!isCurrent()) return;
          const location = result.results[0]?.geometry?.location;
          if (!location) {
            geocodeAttemptsRef.current.add(place.id);
            return;
          }
          setGeocoded((prev) => ({
            ...prev,
            [place.id]: { lat: location.lat(), lng: location.lng() },
          }));
        })
        .catch(() => {
          if (!isCurrent()) return;
          geocodeAttemptsRef.current.add(place.id);
        })
        .finally(() => {
          if (isCurrent()) {
            geocodeInFlightRef.current.delete(place.id);
          }
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, geocodingLibrary]);

  const positioned = useMemo<Positioned[]>(
    () =>
      places.flatMap((p) => {
        if (hasCoords(p)) return [p];
        const g = geocoded[p.id];
        return g ? [{ ...p, lat: g.lat, lng: g.lng }] : [];
      }),
    [places, geocoded],
  );

  const selectedPositioned = positioned.find((p) => p.id === selectedPlaceId);
  const defaultCenter = positioned[0]
    ? { lat: positioned[0].lat, lng: positioned[0].lng }
    : FALLBACK_CENTER;

  return (
    <div className="overflow-hidden rounded-lg border border-border" style={{ height: 300 }}>
      <Map
        mapId="DEMO_MAP_ID"
        defaultCenter={defaultCenter}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        style={{ width: '100%', height: '100%' }}
      >
        {positioned.map((place) => (
          <AdvancedMarker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            onClick={() => onSelectPlace(place.id)}
          >
            <Pin
              background={place.id === selectedPlaceId ? '#1a1a1a' : '#ffffff'}
              borderColor={place.id === selectedPlaceId ? '#1a1a1a' : '#71717a'}
              glyphColor={place.id === selectedPlaceId ? '#ffffff' : '#3f3f46'}
            />
          </AdvancedMarker>
        ))}
        <FitBounds places={positioned} />
        <SelectionPan place={selectedPositioned} />
      </Map>
    </div>
  );
}

export function GuideMap(props: Props) {
  if (!JS_KEY) return null;
  return (
    <APIProvider apiKey={JS_KEY}>
      <GuideMapInner {...props} />
    </APIProvider>
  );
}
