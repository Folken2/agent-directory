'use client';

import { cn } from '@/lib/utils';
import type { GuidePlace } from '@/lib/guide/types';

type Props = {
  place: GuidePlace;
  selected: boolean;
  onSelect: () => void;
};

export function PlaceCard({ place, selected, onSelect }: Props) {
  return (
    <div
      className={cn(
        'w-full rounded-lg border-l-[3px] border border-l-transparent pl-[calc(0.75rem-1px)] pr-3 py-2.5 transition-colors',
        selected
          ? 'border-blue-500/50 border-l-blue-500 bg-blue-500/[0.06] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]'
          : 'border-border/80 border-l-zinc-300 dark:border-l-zinc-600 hover:border-blue-500/35 hover:border-l-blue-400/80 hover:bg-blue-500/[0.03]',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-medium text-[15px] text-foreground">{place.name}</div>
            {place.category && (
              <div className="text-xs text-muted-foreground mt-0.5">{place.category}</div>
            )}
          </div>
          {typeof place.rating === 'number' && (
            <div
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                selected
                  ? 'bg-blue-500/15 text-foreground'
                  : 'bg-muted text-foreground/80',
              )}
            >
              <span className="text-amber-500" aria-hidden>
                ★
              </span>{' '}
              {place.rating.toFixed(1)}
            </div>
          )}
        </div>
        {place.summary && <p className="mt-1.5 text-sm text-foreground/80">{place.summary}</p>}
        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          {place.address && <div>{place.address}</div>}
          {place.hours && <div>{place.hours}</div>}
        </div>
      </button>
      {place.mapsUrl && (
        <a
          href={place.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-xs text-blue-600/90 dark:text-blue-400 underline-offset-2 hover:underline"
        >
          Open in Google Maps
        </a>
      )}
    </div>
  );
}
