import { getGuide, guideMarkdown, loadGuides } from '@/lib/guides';
import { SITE_OWNER, siteUrl } from '@/lib/seo';

/**
 * Serves /guides/<slug>.md (rewritten here in next.config.ts): the guide as
 * plain Markdown for coding agents, built from the same file as the page.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return loadGuides().map((guide) => ({ slug: guide.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return new Response('Not found\n', { status: 404 });

  return new Response(guideMarkdown(guide, siteUrl(), SITE_OWNER), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      // The HTML guide is the page to rank; this copy is for agents.
      'X-Robots-Tag': 'noindex',
    },
  });
}
