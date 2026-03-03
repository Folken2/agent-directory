import { MetadataRoute } from 'next';

async function getAgents(): Promise<Array<{ name: string }>> {
  try {
    // Fetch agents from the internal API route
    // Use absolute URL construction for reliability across environments
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://agentdirectory.folch.ai';
    
    // Try to construct the API URL
    // In Vercel/production, use the base URL. In development, try localhost
    let apiUrl: string;
    if (process.env.VERCEL_URL) {
      apiUrl = `https://${process.env.VERCEL_URL}/api/agents`;
    } else if (process.env.NODE_ENV === 'production') {
      apiUrl = `${baseUrl}/api/agents`;
    } else {
      // Development: try localhost, but this may fail during build
      apiUrl = `http://localhost:${process.env.PORT || 3000}/api/agents`;
    }
    
    const response = await fetch(apiUrl, {
      next: { revalidate: 3600 }, // Revalidate every hour
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.success && Array.isArray(data.data)) {
        return data.data.map((agent: { name: string }) => ({ name: agent.name }));
      }
    }
  } catch (error) {
    // Gracefully handle errors - return empty array to fall back to static pages only
    // This ensures the sitemap still works even if agent fetching fails
    // This is expected during build time when the server isn't running
    if (process.env.NODE_ENV === 'development') {
      console.warn('Could not fetch agents for sitemap, using static pages only:', error);
    }
  }

  return [];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://agentdirectory.folch.ai';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/learn`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/contribute`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/chat`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  // Fetch agents and add dynamic agent pages
  const agents = await getAgents();
  const agentPages: MetadataRoute.Sitemap = agents.map((agent) => ({
    url: `${baseUrl}/agents/${encodeURIComponent(agent.name)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticPages, ...agentPages];
}

