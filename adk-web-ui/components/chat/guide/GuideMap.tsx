'use client';

import { useEffect, useMemo, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
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
  const key = places.map((p) => p.id).join(',');

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
  }, [map, place?.id]);

  return null;
}

function GuideMapInner({ places, selectedPlaceId, onSelectPlace }: Props) {
  const [geocoded, setGeocoded] = useState<Record<string, { lat: number; lng: number }>>({});

  useEffect(() => {
    const toGeocode = places.filter((p) => !hasCoords(p) && !geocoded[p.id]);
    if (toGeocode.length === 0) return;
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return;

    const geocoder = new google.maps.Geocoder();
    let cancelled = false;

    toGeocode.forEach((place) => {
      const query = place.address || place.name;
      if (!query) return;
      geocoder
        .geocode({ address: query })
        .then((result) => {
          if (cancelled) return;
          const location = result.results[0]?.geometry?.location;
          if (!location) return;
          setGeocoded((prev) => ({
            ...prev,
            [place.id]: { lat: location.lat(), lng: location.lng() },
          }));
        })
        .catch(() => {
          // Skip places that fail to geocode; they simply won't get a marker.
        });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

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
        mapId="guide-overview-map"
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
