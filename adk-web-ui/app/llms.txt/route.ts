import { loadOfflineCatalog } from '@/lib/agent-catalog';
import { loadGuides } from '@/lib/guides';
import { buildLlmsTxt, siteUrl } from '@/lib/seo';

// llmstxt.org convention: a Markdown map of the site for coding agents. Indexable.
export const dynamic = 'force-static';

export function GET() {
  return new Response(buildLlmsTxt(loadOfflineCatalog(), loadGuides(), siteUrl()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
