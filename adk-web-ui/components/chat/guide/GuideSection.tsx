'use client';

import type { GuidePlace, GuideSection as GuideSectionType } from '@/lib/guide/types';
import { PlaceCard } from './PlaceCard';

type Props = {
  section: GuideSectionType;
  placeById: Map<string, GuidePlace>;
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
};

export function GuideSectionList({ section, placeById, selectedPlaceId, onSelectPlace }: Props) {
  const places = section.placeIds
    .map((id) => placeById.get(id))
    .filter((place): place is GuidePlace => !!place);

  if (places.length === 0) return null;

  return (
    <div>
      <div className="mb-2">
        <h3 className="text-[15px] font-medium text-foreground">{section.title}</h3>
        {section.blurb && <p className="text-sm text-muted-foreground mt-0.5">{section.blurb}</p>}
      </div>
      <div className="space-y-2">
        {places.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            selected={selectedPlaceId === place.id}
            onSelect={() => onSelectPlace(place.id)}
          />
        ))}
      </div>
    </div>
  );
}
