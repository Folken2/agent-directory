import { readFileSync } from 'fs';
import { join } from 'path';
import { ImageResponse } from 'next/og';

const ADK_LOGO = `data:image/png;base64,${readFileSync(join(process.cwd(), 'public/adk_logo.png')).toString('base64')}`;

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared Open Graph card: site mark, a title and a one-line subtitle. */
export function renderOgCard({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#F8FAFD',
          color: '#1F1F1F',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
          <img src={ADK_LOGO} width={64} height={56} alt="" />
          <div style={{ fontSize: 32, color: '#444746' }}>{eyebrow}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
          <div style={{ fontSize: 34, color: '#444746', lineHeight: 1.35 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 24, color: '#5E5E5E' }}>
          Independent open-source project. Not affiliated with Google.
        </div>
      </div>
    ),
    OG_SIZE
  );
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
