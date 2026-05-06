'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Youtube, BookOpen, FileText, ExternalLink, Video, Play, X } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoResource {
  url: string;
  duration?: string;
}

interface YouTubeMetadata {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  channelName: string;
  channelThumbnail: string | null;
  authorUrl: string;
}

interface VideoCardData extends VideoResource {
  metadata?: YouTubeMetadata;
  isLoading?: boolean;
  error?: string;
}

interface DocResource {
  title: string;
  description: string;
  url: string;
  type: 'docs';
}

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  // Handle watch URLs: https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  
  // Handle short URLs: https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];
  
  // Handle playlist URLs: extract first video ID if available
  const playlistMatch = url.match(/[?&]list=([^&]+)/);
  if (playlistMatch) {
    // For playlists, we'll need to handle differently
    // For now, return null to indicate it's a playlist
    return null;
  }
  
  return null;
}

// Check if URL is a playlist
function isPlaylist(url: string): boolean {
  return url.includes('playlist?list=');
}

const resources: (VideoResource | DocResource)[] = [
  // Official Google for Developers videos
  {
    url: 'https://www.youtube.com/watch?v=18RwoSxfb3A',
  },
  {
    url: 'https://www.youtube.com/watch?v=jZXvqEqJT7o',
  },
  {
    url: 'https://www.youtube.com/watch?v=5_R_Ixk8ENQ',
  },
  {
    url: 'https://www.youtube.com/watch?v=6mQwHqK1I5w',
  },
  {
    url: 'https://www.youtube.com/watch?v=W3h_-eCcmqc',
  },
  {
    url: 'https://www.youtube.com/watch?v=L3eKHw9df-g',
  },
  {
    url: 'https://www.youtube.com/playlist?list=PL2OwQjtoKA1F4m0__4e8gh_X0YZqRpm9Z',
  },
  // Additional tutorials
  {
    url: 'https://www.youtube.com/watch?v=zgc8l1c83x8',
  },
  {
    url: 'https://www.youtube.com/watch?v=P4VFL9nIaIA',
  },
  {
    url: 'https://www.youtube.com/playlist?list=PLLrA_pU9-Gz2HwepRUVpq1TEPuYWo_fSi',
  },
  {
    title: 'Google ADK Official Documentation',
    description: 'Complete documentation for Google Agent Development Kit. Learn about the core concepts, API references, and best practices for building AI agents.',
    url: 'https://ai.google.dev/adk',
    type: 'docs',
  },
  {
    title: 'Getting Started with ADK',
    description: 'Learn how to build your first AI agent from scratch. This guide covers setting up your environment, creating a basic agent, and deploying it.',
    url: 'https://ai.google.dev/adk/docs/get-started',
    type: 'docs',
  },
  {
    title: 'Gemini API Documentation',
    description: 'Official Gemini API reference. Explore the capabilities of the Gemini models, including text generation, multimodal inputs, and function calling.',
    url: 'https://ai.google.dev/docs',
    type: 'docs',
  },
];

export default function LearnPage() {
  const [items, setItems] = useState<(VideoCardData | DocResource)[]>(
    resources.map((res) => 'type' in res ? res : { ...res, isLoading: true })
  );
  const [selectedVideo, setSelectedVideo] = useState<{
    url: string;
    videoId: string | null;
    metadata?: YouTubeMetadata;
    isPlaylist: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      const updatedItems = await Promise.all(
        resources.map(async (res) => {
          if ('type' in res) return res; // Skip docs/articles

          try {
            const response = await fetch(
              `/api/youtube/metadata?url=${encodeURIComponent(res.url)}`
            );
            if (response.ok) {
              const result = await response.json();
              return {
                ...res,
                metadata: result.data,
                isLoading: false,
              };
            } else {
              return {
                ...res,
                isLoading: false,
                error: 'Failed to load metadata',
              };
            }
          } catch (error) {
            return {
              ...res,
              isLoading: false,
              error: 'Failed to load metadata',
            };
          }
        })
      );
      setItems(updatedItems);
    };

    fetchMetadata();
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedVideo) {
        setSelectedVideo(null);
      }
    };

    if (selectedVideo) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [selectedVideo]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Unified Resources Grid */}
        <div className="mb-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, index) => {
              // Handle Docs
              if ('type' in item) {
                return (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group bg-md-surface border border-md-outline/60 hover:border-md-primary/40 hover:shadow-elevation-3 rounded-xl overflow-hidden transition-all duration-300 flex flex-col h-full"
                  >
                    <div className="aspect-video bg-md-surface-container flex items-center justify-center p-8 relative overflow-hidden group-hover:bg-md-surface-variant/50 transition-colors">
                      <div className="absolute inset-0 bg-md-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-16 h-16 rounded-2xl bg-md-surface elevation-1 flex items-center justify-center z-10 group-hover:scale-110 transition-transform duration-300">
                        <FileText className="w-8 h-8 text-md-primary" />
                      </div>
                    </div>
                    <div className="p-8 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-md-secondary-container text-md-on-secondary-container text-label-small font-medium">
                          <BookOpen className="w-3 h-3" />
                          Documentation
                        </span>
                        <ExternalLink className="w-4 h-4 text-md-on-surface-variant shrink-0" />
                      </div>
                      <h3 className="text-title-large text-md-on-surface group-hover:text-md-primary transition-colors mb-3 leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-body-medium text-md-on-surface-variant leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    </div>
                  </a>
                );
              }

              // Handle Videos loading state
              if (item.isLoading) {
                return (
                  <div
                    key={index}
                    className="bg-md-surface border border-md-outline/60 rounded-xl overflow-hidden animate-pulse h-full"
                  >
                    <div className="aspect-video bg-md-surface-container" />
                    <div className="p-8">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-md-surface-container" />
                        <div className="flex-1">
                          <div className="h-5 bg-md-surface-container rounded w-3/4 mb-2" />
                          <div className="h-4 bg-md-surface-container rounded w-1/2" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-md-surface-container rounded w-full" />
                        <div className="h-4 bg-md-surface-container rounded w-5/6" />
                        <div className="h-4 bg-md-surface-container rounded w-4/6" />
                      </div>
                    </div>
                  </div>
                );
              }

              // Handle Videos error state
              if (item.error || !item.metadata) {
                return null; // Skip errored items
              }

              const { metadata } = item;
              const videoId = extractVideoId(item.url);
              const isPlaylistUrl = isPlaylist(item.url);

              const handleVideoClick = (e: React.MouseEvent) => {
                e.preventDefault();
                if (isPlaylistUrl) {
                  // For playlists, open in new tab
                  window.open(item.url, '_blank', 'noopener,noreferrer');
                } else {
                  setSelectedVideo({
                    url: item.url,
                    videoId,
                    metadata,
                    isPlaylist: false,
                  });
                }
              };

              return (
                <button
                  key={item.url}
                  onClick={handleVideoClick}
                  className="group bg-md-surface border border-md-outline/60 hover:border-md-primary/40 hover:shadow-elevation-3 rounded-xl overflow-hidden transition-all duration-300 flex flex-col h-full text-left cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-md-surface-container overflow-hidden">
                    <Image
                      src={metadata.thumbnail}
                      alt={metadata.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src.includes('maxresdefault')) {
                          target.src = `https://img.youtube.com/vi/${metadata.videoId}/hqdefault.jpg`;
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="bg-red-600 rounded-full p-4 elevation-3 transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-8 h-8 text-white fill-white ml-1" />
                      </div>
                    </div>
                    {item.duration && (
                      <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm text-white text-label-small px-2 py-1 rounded-md">
                        {item.duration}
                      </div>
                    )}
                  </div>

                  {/* Video Info */}
                  <div className="p-8 flex flex-col flex-1">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="relative shrink-0">
                        {metadata.channelThumbnail ? (
                          <img
                            src={metadata.channelThumbnail}
                            alt={metadata.channelName}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full border border-md-outline object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.parentElement?.querySelector('.channel-fallback') as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-10 h-10 rounded-full bg-md-primary-container flex items-center justify-center channel-fallback ${metadata.channelThumbnail ? 'hidden' : ''}`}
                        >
                          <Youtube className="w-5 h-5 text-red-500" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-label-medium text-md-on-surface-variant font-medium truncate">
                          {metadata.channelName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider border border-red-100">
                            Video
                          </span>
                        </div>
                      </div>
                    </div>

                    <h3
                      className="text-title-large text-md-on-surface group-hover:text-md-primary transition-colors mb-3 leading-snug line-clamp-2"
                      title={metadata.title}
                    >
                      {metadata.title}
                    </h3>

                    <p className="text-body-medium text-md-on-surface-variant leading-relaxed line-clamp-3">
                      {metadata.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Video Modal */}
        <AnimatePresence>
          {selectedVideo && selectedVideo.videoId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setSelectedVideo(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="relative bg-md-surface rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] border border-md-outline overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors backdrop-blur-sm"
                  aria-label="Close video"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                {/* Video Embed */}
                <div className="relative w-full flex-shrink-0" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0`}
                    title={selectedVideo.metadata?.title || 'YouTube video player'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute top-0 left-0 w-full h-full rounded-t-2xl"
                  />
                </div>

                {/* Video Info */}
                {selectedVideo.metadata && (
                  <div className="p-4 sm:p-6 bg-md-surface overflow-y-auto flex-1">
                    <h3 className="text-title-medium sm:text-title-large text-md-on-surface mb-2 line-clamp-2">
                      {selectedVideo.metadata.title}
                    </h3>
                    <div className="flex items-center gap-3 mb-3">
                      {selectedVideo.metadata.channelThumbnail ? (
                        <img
                          src={selectedVideo.metadata.channelThumbnail}
                          alt={selectedVideo.metadata.channelName}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full border border-md-outline object-cover flex-shrink-0"
                        />
                      ) : null}
                      <p className="text-body-small sm:text-body-medium text-md-on-surface-variant truncate">
                        {selectedVideo.metadata.channelName}
                      </p>
                    </div>
                    <p className="text-body-small text-md-on-surface-variant line-clamp-3 mb-4">
                      {selectedVideo.metadata.description}
                    </p>
                    <a
                      href={selectedVideo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-md-primary hover:text-md-primary/80 transition-colors text-label-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Watch on YouTube
                    </a>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <div className="bg-md-primary-container/30 rounded-2xl border border-md-primary/20 p-8 text-center">
          <h2 className="text-title-large text-md-on-surface mb-2">
            Want to Contribute?
          </h2>
          <p className="text-body-medium text-md-on-surface-variant mb-6">
            Have a great resource to share? Contribute to the ADK Agent Directory community!
          </p>
          <Link
            href="/contribute"
            className="inline-flex items-center gap-2 px-6 py-3 bg-md-primary hover:bg-md-primary/92 text-md-on-primary rounded-full text-label-large transition-all elevation-1 hover:elevation-2"
          >
            Learn How to Contribute
          </Link>
        </div>
      </div>
    </div>
  );
}

