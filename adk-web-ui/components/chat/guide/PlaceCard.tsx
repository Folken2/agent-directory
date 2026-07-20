'use client';

import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { GuidePlace } from '@/lib/guide/types';

type Props = {
  place: GuidePlace;
  selected: boolean;
  onSelect: () => void;
};

export function PlaceCard({ place, selected, onSelect }: Props) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer',
        selected ? 'border-foreground/40 bg-muted/50' : 'border-border/60 hover:bg-muted/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-[15px] text-foreground">{place.name}</div>
          {place.category && (
            <div className="text-xs text-muted-foreground mt-0.5">{place.category}</div>
          )}
        </div>
        {typeof place.rating === 'number' && (
          <div className="text-xs text-muted-foreground shrink-0">★ {place.rating.toFixed(1)}</div>
        )}
      </div>
      {place.summary && <p className="mt-1.5 text-sm text-foreground/80">{place.summary}</p>}
      <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        {place.address && <div>{place.address}</div>}
        {place.hours && <div>{place.hours}</div>}
      </div>
      {place.mapsUrl && (
        <a
          href={place.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-xs text-foreground/70 underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Open in Google Maps
        </a>
      )}
    </div>
  );
}
