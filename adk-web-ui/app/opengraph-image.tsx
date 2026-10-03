import { OG_SIZE, renderOgCard } from '@/lib/og-image';

export const alt = 'ADK Agent Directory';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function OpengraphImage() {
  return renderOgCard({
    eyebrow: 'ADK Agent Directory',
    title: 'Describe the agent you want to build',
    subtitle: "Design it with an agent builder, then try working examples built with Google's Agent Development Kit.",
  });
}
