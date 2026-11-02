import { MetadataRoute } from 'next';
import { loadOfflineCatalog } from '@/lib/agent-catalog';
import { buildSitemap, siteUrl } from '@/lib/seo';

// Same catalog the agent pages are prerendered from, so every built page is listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(loadOfflineCatalog(), siteUrl());
}
