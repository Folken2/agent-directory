'use client';

import { cn } from '@/lib/utils';
import type { GuidePlace } from '@/lib/guide/types';

type Props = {
  place: GuidePlace;
  selected: boolean;
  onSelect: () => void;
};

function metaLine(place: GuidePlace): string | null {
  const parts = [place.address, place.hours].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function PlaceCard({ place, selected, onSelect }: Props) {
  const meta = metaLine(place);

  return (
    <div
      data-place-id={place.id}
      className={cn(
        'w-full rounded-lg border px-2.5 py-2 transition-colors',
        selected
          ? 'border-md-on-surface/35 bg-md-surface-container/50'
          : 'border-md-outline/70 active:bg-md-surface-container/40',
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="w-full min-h-11 cursor-pointer border-0 bg-transparent p-0 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-[15px] leading-snug text-md-on-surface">
                {place.name}
              </span>
              {place.category && (
                <span className="rounded-full bg-md-surface-container px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-md-on-surface-variant">
                  {place.category}
                </span>
              )}
            </div>
          </div>
          {typeof place.rating === 'number' && (
            <div
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                selected ? 'bg-md-surface-container text-md-on-surface' : 'bg-md-surface-container text-md-on-surface/80',
              )}
            >
              <span className="text-amber-500" aria-hidden>
                ★
              </span>{' '}
              {place.rating.toFixed(1)}
            </div>
          )}
        </div>
        {place.summary && (
          <p className="mt-1 text-sm leading-snug text-md-on-surface/80 line-clamp-2">
            {place.summary}
          </p>
        )}
        {meta && (
          <p className="mt-1 text-[11px] leading-snug text-md-on-surface-variant line-clamp-2">
            {meta}
          </p>
        )}
      </button>
      {place.mapsUrl && (
        <a
          href={place.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex min-h-9 items-center text-xs font-medium text-blue-600/90 dark:text-blue-400 underline-offset-2 hover:underline"
        >
          Open in Maps
        </a>
      )}
    </div>
  );
}
