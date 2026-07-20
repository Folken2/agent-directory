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
