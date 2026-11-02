import { MetadataRoute } from 'next';
import { loadOfflineCatalog } from '@/lib/agent-catalog';
import { loadGuides } from '@/lib/guides';
import { buildSitemap, siteUrl } from '@/lib/seo';

// Same catalog and guide files the pages are prerendered from, so every built page is listed.
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(loadOfflineCatalog(), siteUrl(), loadGuides());
}
