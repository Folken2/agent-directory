/**
 * Company logo tile for crawler analytics.
 *
 * Uses the real brand favicon (PNG) for the company's canonical domain.
 * Falls back to a monogram when the icon fails to load or no domain is known.
 */

'use client';

import { useState } from 'react';
import { brandIconUrl } from '@/lib/analytics/bot-companies';

type Props = {
  id: string;
  name: string;
  color: string;
  domain?: string | null;
  size?: number;
  className?: string;
};

/** Relative luminance — near-black brands get a surface tile so they stay visible. */
function isDarkBrand(hex: string): boolean {
  const value = hex.replace('#', '');
  if (value.length !== 6) return false;
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.22;
}

function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0]?.[0] ?? '?').toUpperCase();
}

/**
 * Small square logo tile. Real favicon PNG when a domain is known; monogram
 * otherwise (or if the favicon request fails).
 */
export default function BrandMark({
  id,
  name,
  color,
  domain,
  size = 28,
  className,
}: Props) {
  const [failed, setFailed] = useState(false);
  const src = brandIconUrl(domain, 64);
  const dark = isDarkBrand(color);
  const tint = dark ? undefined : `${color}1f`;
  const showIcon = Boolean(src) && !failed;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg overflow-hidden ${
        dark ? 'bg-md-surface-container-high text-md-on-surface' : ''
      } ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: tint,
        color: dark ? undefined : color,
      }}
      aria-hidden
      title={name}
      data-company={id}
    >
      {showIcon ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote favicon; monogram fallback on error
        <img
          src={src!}
          alt=""
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          className="object-contain"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="font-semibold leading-none tracking-tight"
          style={{ fontSize: size * 0.36 }}
        >
          {monogram(name)}
        </span>
      )}
    </span>
  );
}
