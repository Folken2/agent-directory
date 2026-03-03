import { NextRequest, NextResponse } from 'next/server';

// Extract YouTube video ID from URL
function getYouTubeVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// Get YouTube thumbnail URL
function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

// Extract channel handle/ID from YouTube channel URL
function extractChannelHandle(channelUrl: string): string | null {
  const patterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = channelUrl.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get YouTube channel thumbnail
// Note: Without YouTube Data API, this tries to extract from channel page HTML
async function getYouTubeChannelThumbnail(authorUrl: string): Promise<string | null> {
  try {
    const handle = extractChannelHandle(authorUrl);
    if (!handle) return null;

    // Try to fetch channel page and extract thumbnail from meta tags
    try {
      // Normalize channel URL
      let channelPageUrl = authorUrl;
      if (!authorUrl.includes('/@') && !authorUrl.includes('/channel/') && !authorUrl.includes('/c/') && !authorUrl.includes('/user/')) {
        channelPageUrl = `https://www.youtube.com/@${handle}`;
      }
      
      const response = await fetch(channelPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Try multiple methods to extract channel thumbnail
        
        // Method 1: og:image meta tag - but filter out video thumbnails
        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogImageMatch && ogImageMatch[1]) {
          const imageUrl = ogImageMatch[1];
          // Check if it's a channel avatar (contains yt3.ggpht.com or yt3.googleusercontent.com)
          // and is NOT a video thumbnail (doesn't contain /vi/)
          if ((imageUrl.includes('yt3.ggpht.com') || imageUrl.includes('yt3.googleusercontent.com')) 
              && !imageUrl.includes('/vi/')) {
            return imageUrl;
          }
        }
        
        // Method 2: JSON-LD structured data - look for channel avatar
        const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatches) {
          for (const jsonLd of jsonLdMatches) {
            try {
              const jsonContent = jsonLd.replace(/<script[^>]*>|<\/script>/gi, '').trim();
              const data = JSON.parse(jsonContent);
              
              // Look for channel avatar in various places
              if (data.image && typeof data.image === 'string') {
                if (data.image.includes('yt3.ggpht.com') || data.image.includes('yt3.googleusercontent.com')) {
                  return data.image;
                }
              }
              
              if (data.avatar && typeof data.avatar === 'string') {
                return data.avatar;
              }
              
              if (data.logo && typeof data.logo === 'string') {
                if (data.logo.includes('yt3.ggpht.com') || data.logo.includes('yt3.googleusercontent.com')) {
                  return data.logo;
                }
              }
              
              // Check nested objects
              if (data.publisher && data.publisher.logo) {
                return data.publisher.logo;
              }
            } catch (e) {
              // Continue to next JSON-LD block
            }
          }
        }
        
        // Method 3: Look for channel avatar in ytInitialData
        const ytInitialDataMatch = html.match(/var\s+ytInitialData\s*=\s*({.+?});/);
        if (ytInitialDataMatch) {
          try {
            const ytData = JSON.parse(ytInitialDataMatch[1]);
            // Navigate through the data structure to find channel avatar
            const avatarPath = ytData?.header?.c4TabbedHeaderRenderer?.avatar?.thumbnails?.[0]?.url ||
                             ytData?.metadata?.channelMetadataRenderer?.avatar?.thumbnails?.[0]?.url;
            if (avatarPath) {
              return avatarPath;
            }
          } catch (e) {
            // Continue
          }
        }
        
        // Method 4: Look for avatar URL pattern in HTML
        const avatarPattern = /(https:\/\/yt3\.(ggpht|googleusercontent)\.com\/[^"'\s<>]+)/gi;
        const avatarMatches = html.match(avatarPattern);
        if (avatarMatches) {
          // Filter for avatar-like URLs (usually contain 's48', 's88', 's176', etc.)
          const avatarUrl = avatarMatches.find(url => 
            url.includes('s48') || url.includes('s88') || url.includes('s176') || url.includes('s288')
          );
          if (avatarUrl) {
            return avatarUrl;
          }
        }
      }
    } catch (error) {
      // Silently fail - will use placeholder
      console.error('Error fetching channel thumbnail:', error);
    }
  } catch (error) {
    console.error('Error extracting channel thumbnail:', error);
  }
  return null;
}

// Get YouTube video description from video page HTML
async function getYouTubeVideoDescription(videoId: string): Promise<string> {
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();

    // Method 1: Try to extract from JSON-LD structured data
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const jsonLd of jsonLdMatches) {
        try {
          const jsonContent = jsonLd.replace(/<script[^>]*>|<\/script>/gi, '').trim();
          const data = JSON.parse(jsonContent);
          
          // Look for description in various places
          if (data.description && typeof data.description === 'string' && data.description.length > 0) {
            return data.description;
          }
          
          // Check if it's an array (some structured data formats)
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.description && typeof item.description === 'string' && item.description.length > 0) {
                return item.description;
              }
            }
          }
        } catch (e) {
          // Continue to next JSON-LD block
        }
      }
    }

    // Method 2: Try to extract from ytInitialPlayerResponse (more reliable)        
    const ytInitialPlayerResponseMatch = html.match(/var\s+ytInitialPlayerResponse\s*=\s*({[\s\S]+?});/);
    if (ytInitialPlayerResponseMatch) {
      try {
        const playerData = JSON.parse(ytInitialPlayerResponseMatch[1]);
        const description = playerData?.videoDetails?.shortDescription || 
                          playerData?.videoDetails?.description;
        if (description && typeof description === 'string' && description.length > 0) {
          return description;
        }
      } catch (e) {
        // Continue to next method
      }
    }

    // Method 3: Try to extract from ytInitialData
    const ytInitialDataMatch = html.match(/var\s+ytInitialData\s*=\s*({[\s\S]+?});\s*(?:var\s+ytInitialPlayerResponse|<\/script>|$)/);
    if (ytInitialDataMatch) {
      try {
        const ytData = JSON.parse(ytInitialDataMatch[1]);
        
        // Try alternative path for description from secondary info
        const secondaryInfo = ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[1]?.videoSecondaryInfoRenderer;
        if (secondaryInfo?.description?.runs) {
          const descriptionText = secondaryInfo.description.runs
            .map((run: any) => run.text || '')
            .join('')
            .trim();
          if (descriptionText.length > 0) {
            return descriptionText;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Method 4: Try meta description tag (fallback, usually truncated)
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaDescMatch && metaDescMatch[1]) {
      return metaDescMatch[1];
    }
  } catch (error) {
    console.error('Error fetching video description:', error);
  }
  return '';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'YouTube URL is required' },
      { status: 400 }
    );
  }

  const videoId = getYouTubeVideoId(url);
  if (!videoId) {
    return NextResponse.json(
      { error: 'Invalid YouTube URL' },
      { status: 400 }
    );
  }

  try {
    // Use YouTube oEmbed API (no API key required)
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oEmbedResponse = await fetch(oEmbedUrl);
    
    if (!oEmbedResponse.ok) {
      throw new Error('Failed to fetch video metadata');
    }

    const oEmbedData = await oEmbedResponse.json();

    // Extract channel name from author_name
    const channelName = oEmbedData.author_name || 'Unknown Channel';
    
    // Get thumbnail
    const thumbnail = getYouTubeThumbnail(videoId);
    
    // Try to get channel thumbnail from author_url
    let channelThumbnail: string | null = null;
    if (oEmbedData.author_url) {
      channelThumbnail = await getYouTubeChannelThumbnail(oEmbedData.author_url);
    }

    // Get video description from video page
    const description = await getYouTubeVideoDescription(videoId);

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        title: oEmbedData.title,
        description: description || '',
        thumbnail,
        channelName,
        channelThumbnail,
        authorUrl: oEmbedData.author_url,
      },
    });
  } catch (error) {
    console.error('Error fetching YouTube metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video metadata' },
      { status: 500 }
    );
  }
}

