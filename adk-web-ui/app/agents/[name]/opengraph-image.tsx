import { notFound } from 'next/navigation';
import { getCatalogAgent } from '@/lib/agent-catalog';
import { OG_SIZE, renderOgCard, truncate } from '@/lib/og-image';

export const alt = 'Agent on ADK Agent Directory';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function AgentOpengraphImage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = getCatalogAgent(decodeURIComponent(name));
  if (!agent) notFound();
  return renderOgCard({
    eyebrow: 'ADK Agent Directory',
    title: truncate(agent.displayName, 60),
    subtitle: truncate(agent.description, 160),
  });
}
