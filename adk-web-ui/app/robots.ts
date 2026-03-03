import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://agentdirectory.folch.ai';

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

