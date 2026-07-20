'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

export function GuideAnswer({ document: guide, mapSlot }: Props) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    guide.places[0]?.id ?? null,
  );
  const placeById = useMemo(
    () => new Map(guide.places.map((p) => [p.id, p])),
    [guide.places],
  );

  // Keep the selected card in view when the user taps a map pin (mobile).
  useEffect(() => {
    if (!selectedPlaceId) return;
    const el = globalThis.document.querySelector(
      `[data-place-id="${CSS.escape(selectedPlaceId)}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedPlaceId]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <p className="text-[15px] leading-snug text-foreground">{guide.lead}</p>
      {mapSlot?.({
        places: guide.places,
        selectedPlaceId,
        onSelectPlace: setSelectedPlaceId,
      })}
      <div className="space-y-4 sm:space-y-5">
        {guide.sections.map((section) => (
          <GuideSectionList
            key={section.id}
            section={section}
            placeById={placeById}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
          />
        ))}
      </div>
      {guide.sources && guide.sources.length > 0 && (
        <GuideSources sources={guide.sources} />
      )}
    </div>
  );
}
