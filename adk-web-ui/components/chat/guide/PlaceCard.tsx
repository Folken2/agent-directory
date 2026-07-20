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
        'w-full rounded-lg border border-l-4 pl-2.5 pr-2.5 py-2 transition-colors',
        selected
          ? 'border-blue-500/45 border-l-blue-500 bg-blue-500/[0.07]'
          : 'border-border/70 border-l-zinc-200 dark:border-l-zinc-700 active:bg-muted/40',
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
              <span className="font-medium text-[15px] leading-snug text-foreground">
                {place.name}
              </span>
              {place.category && (
                <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {place.category}
                </span>
              )}
            </div>
          </div>
          {typeof place.rating === 'number' && (
            <div
              className={cn(
                'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                selected ? 'bg-blue-500/15 text-foreground' : 'bg-muted text-foreground/80',
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
          <p className="mt-1 text-sm leading-snug text-foreground/80 line-clamp-2">
            {place.summary}
          </p>
        )}
        {meta && (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">
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
