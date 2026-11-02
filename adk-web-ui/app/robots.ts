import { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = siteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // No disallow rules - full access for all robots
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

