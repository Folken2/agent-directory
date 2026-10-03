'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'size-9 p-1.5 text-sm',
  md: 'size-11 p-2 text-base',
  lg: 'size-14 p-2.5 text-xl',
} as const;

/**
 * An agent's logo in a neutral tile. Logos are remote favicons, so a failed
 * load falls back to the first letter of the name instead of a broken image.
 */
export default function AgentLogo({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--md-shape-md)] border border-md-outline/60 bg-md-surface font-medium text-md-on-surface-variant',
        SIZES[size],
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote favicons of varying hosts
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
          // A server-rendered image can fail before hydration attaches onError;
          // decode() rejects for those too.
          ref={(img) => {
            img?.decode().catch(() => setFailed(true));
          }}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
