/**
 * Company logo tile for crawler analytics.
 *
 * Marks are hand-built from primitives (no external icon fetch, CSP-safe).
 * Companies without a drawn mark fall back to a branded monogram tile.
 */

import type { ReactNode } from 'react';

type Props = {
  id: string;
  name: string;
  color: string;
  size?: number;
  className?: string;
};

/** Relative luminance — near-black brands are re-tinted so they survive dark mode. */
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

/** Point on a circle centred at (12,12), radius r, at `deg` (0 = east, CCW). */
function pt(deg: number, r: number): string {
  const rad = (deg * Math.PI) / 180;
  return `${(12 + r * Math.cos(rad)).toFixed(2)} ${(12 - r * Math.sin(rad)).toFixed(2)}`;
}

function arc(from: number, to: number, r: number): string {
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  // SVG y is flipped, so counter-clockwise in maths = sweep-flag 0.
  return `M ${pt(from, r)} A ${r} ${r} 0 ${large} 0 ${pt(to, r)}`;
}

const GOOGLE_G = (
  <g fill="none" strokeWidth="3.6" strokeLinecap="butt">
    <path d={arc(40, 160, 8)} stroke="#EA4335" />
    <path d={arc(160, 232, 8)} stroke="#FBBC05" />
    <path d={arc(232, 320, 8)} stroke="#34A853" />
    <path d={arc(320, 388, 8)} stroke="#4285F4" />
    <path d="M 12.4 12 H 20.2" stroke="#4285F4" strokeWidth="3.6" />
  </g>
);

const MICROSOFT_SQUARES = (
  <g>
    <rect x="3" y="3" width="8.2" height="8.2" fill="#F25022" />
    <rect x="12.8" y="3" width="8.2" height="8.2" fill="#7FBA00" />
    <rect x="3" y="12.8" width="8.2" height="8.2" fill="#00A4EF" />
    <rect x="12.8" y="12.8" width="8.2" height="8.2" fill="#FFB900" />
  </g>
);

/** Claude/Anthropic sunburst: six bars through the centre = twelve rays. */
const SUNBURST = (
  <g fill="currentColor">
    {[0, 30, 60, 90, 120, 150].map((angle) => (
      <rect
        key={angle}
        x="10.85"
        y="1.8"
        width="2.3"
        height="20.4"
        rx="1.15"
        transform={`rotate(${angle} 12 12)`}
      />
    ))}
  </g>
);

const MARKS: Record<string, ReactNode> = {
  anthropic: SUNBURST,
  google: GOOGLE_G,
  microsoft: MICROSOFT_SQUARES,

  openai: (
    <g fill="none" stroke="currentColor" strokeWidth="1.7">
      {[0, 60, 120].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="12"
          rx="9"
          ry="4.1"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
    </g>
  ),

  meta: (
    <path
      d="M12 12C9.4 6.4 3.2 6.1 3.2 12S9.4 17.6 12 12s8.8-5.9 8.8 0-6.2 5.6-8.8 0Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
    />
  ),

  apple: (
    <g fill="currentColor">
      <path d="M16.9 12.9c0-2.2 1.7-3.2 1.8-3.3-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.6.8-3.3.8s-1.7-.8-2.8-.8c-1.5 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7c1.1 0 1.9-1 2.6-2.1.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.3-.9-2.3-3.3Z" />
      <path d="M14.8 6.5c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2Z" />
    </g>
  ),

  amazon: (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M3.5 15.6c3 2.3 6.6 3.4 10 3.4 2.4 0 4.9-.5 7.1-1.6" strokeWidth="2" />
      <path d="M18.6 13.9c1.6-.4 3.1-.1 3.4.4.3.6-.4 2-1 2.8" strokeWidth="1.6" />
    </g>
  ),

  vercel: <path d="M12 3.8 21.5 20.2H2.5Z" fill="currentColor" />,

  x: (
    <path
      d="M4 3.6h4.3l4.2 5.7 4.9-5.7h2.3l-6.1 7.1 6.6 9h-4.3l-4.5-6.1-5.2 6.1H3.9l6.5-7.6Z"
      fill="currentColor"
    />
  ),

  telegram: (
    <path
      d="M21.3 4.2 2.9 11.3c-.9.4-.9.9-.1 1.1l4.6 1.4 1.8 5.4c.2.6.4.8 1 .3l2.5-2.3 4.7 3.5c.9.5 1.4.2 1.6-.8l3-13.9c.2-1-.4-1.4-1.7-.8Zm-3 3.3-7.6 6.9-.3 3.2-1.6-4.9 9-5.9c.4-.3.8-.1.5.7Z"
      fill="currentColor"
    />
  ),

  discord: (
    <path
      d="M19.3 6.4A15.5 15.5 0 0 0 15.5 5l-.3.5c1.4.4 2.5 1 3.5 1.6a12 12 0 0 0-10.4 0c1-.7 2.2-1.3 3.5-1.6L11.5 5c-1.4.2-2.7.7-3.8 1.4C5.5 9.8 4.8 13.2 5.1 16.5A15 15 0 0 0 9.7 19l1-1.7c-.6-.2-1.2-.5-1.7-.9l.4-.3a10.7 10.7 0 0 0 9.2 0l.4.3c-.5.4-1.1.7-1.7.9l1 1.7a15 15 0 0 0 4.6-2.5c.4-3.8-.6-7.2-2.6-10.1ZM9.7 14.6c-.9 0-1.6-.8-1.6-1.9s.7-1.9 1.6-1.9 1.7.9 1.6 1.9c0 1.1-.7 1.9-1.6 1.9Zm5.6 0c-.9 0-1.6-.8-1.6-1.9s.7-1.9 1.6-1.9 1.7.9 1.6 1.9c0 1.1-.7 1.9-1.6 1.9Z"
      fill="currentColor"
    />
  ),

};

/**
 * Small square logo tile. Falls back to a monogram when we have no vetted mark,
 * and to theme-aware ink for near-black brands so they stay visible in dark mode.
 */
export default function BrandMark({ id, name, color, size = 28, className }: Props) {
  const mark = MARKS[id];
  const dark = isDarkBrand(color);
  const ink = dark ? 'currentColor' : color;
  const tint = dark ? undefined : `${color}1f`;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg ${
        dark ? 'bg-md-surface-container-high text-md-on-surface' : ''
      } ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: tint,
        color: ink,
      }}
      aria-hidden
      title={name}
    >
      {mark ? (
        <svg
          viewBox="0 0 24 24"
          width={size * 0.62}
          height={size * 0.62}
          role="img"
          aria-label={name}
        >
          {mark}
        </svg>
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
