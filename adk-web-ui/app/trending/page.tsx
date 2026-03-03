'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { TrendingUp, Plus, ArrowUp, MessageCircle, Heart, User, Clock, X } from 'lucide-react';

interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  likes: number;
  comments: number;
  likedBy: string[];
}

export default function TrendingPage() {
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isAuthenticated = status === 'authenticated' && !!session?.user;
  const currentUser = session?.user
    ? { id: session.user.id, name: session.user.name || '' }
    : null;

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!isAuthenticated) {
      alert('Please sign in to like posts');
      return;
    }

    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id }),
      });

      if (response.ok) {
        loadPosts(); // Reload posts to get updated likes
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-md-surface via-md-surface-container-low/50 to-md-surface-container-low pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-md-primary-container rounded-xl elevation-1">
              <TrendingUp className="w-6 h-6 text-md-on-primary-container" />
            </div>
            <div>
              <h1 className="text-display-small text-md-on-surface">
                Trending
              </h1>
              <p className="text-body-medium text-md-on-surface-variant mt-1">
                Community discussions and posts
              </p>
            </div>
          </div>
          {isAuthenticated ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-md-primary hover:bg-md-primary/92 text-md-on-primary rounded-full text-label-large transition-all elevation-1 hover:elevation-2"
            >
              <Plus className="w-4 h-4" />
              New Post
            </button>
          ) : (
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-md-primary hover:bg-md-primary/92 text-md-on-primary rounded-full text-label-large transition-all elevation-1 hover:elevation-2"
            >
              Sign In to Post
            </Link>
          )}
        </div>

        {/* Posts List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-md-surface elevation-1 rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-md-surface-container rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-md-surface-container rounded w-full mb-2"></div>
                <div className="h-4 bg-md-surface-container rounded w-5/6"></div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24 bg-md-surface-variant/30 rounded-3xl border border-dashed border-md-outline">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-md-surface-container rounded-full elevation-1">
                <MessageCircle className="w-8 h-8 text-md-on-surface-variant" />
              </div>
              <div>
                <p className="text-title-medium text-md-on-surface">No posts yet</p>
                <p className="text-body-small text-md-on-surface-variant mt-1">
                  {isAuthenticated
                    ? 'Be the first to share something with the community!'
                    : 'Sign in to create the first post.'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const isLiked = currentUser && post.likedBy.includes(currentUser.id);
              return (
                <div
                  key={post.id}
                  className="bg-md-surface elevation-1 hover:elevation-3 rounded-xl p-6 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => handleLike(post.id)}
                        className={`p-2 rounded-lg transition-all ${isLiked
                            ? 'bg-md-primary-container text-md-on-primary-container elevation-1'
                            : 'text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant'
                          }`}
                        disabled={!isAuthenticated}
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                      <span className="text-label-medium text-md-on-surface">
                        {post.likes}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-title-large text-md-on-surface mb-2">
                        {post.title}
                      </h2>
                      <p className="text-body-medium text-md-on-surface-variant mb-4 whitespace-pre-wrap">
                        {post.content}
                      </p>
                      <div className="flex items-center gap-4 text-label-small text-md-on-surface-variant">
                        <div className="flex items-center gap-1.5">
                          <User className="w-4 h-4" />
                          <span>{post.author}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{formatDate(post.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MessageCircle className="w-4 h-4" />
                          <span>{post.comments} comments</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadPosts();
          }}
        />
      )}
    </div>
  );
}

function CreatePostModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: session } = useSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    if (!session?.user) {
      alert('Please sign in to post');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          authorId: session.user.id,
          author: session.user.name || 'Anonymous',
        }),
      });

      if (response.ok) {
        setTitle('');
        setContent('');
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-md-surface/90 backdrop-blur-sm">
      <div className="bg-md-surface rounded-2xl border border-md-outline elevation-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-headline-small text-md-on-surface">Create Post</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-md-surface-variant rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-md-on-surface-variant" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-label-large text-md-on-surface mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter post title..."
                className="w-full px-4 py-3 rounded-lg bg-md-surface-container text-md-on-surface border border-md-outline placeholder:text-md-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-md-primary transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-label-large text-md-on-surface mb-2">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                rows={8}
                className="w-full px-4 py-3 rounded-lg bg-md-surface-container text-md-on-surface border border-md-outline placeholder:text-md-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-md-primary transition-all resize-none"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-variant rounded-lg text-label-large transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim() || !content.trim()}
                className="px-6 py-2.5 bg-md-primary hover:bg-md-primary/92 text-md-on-primary rounded-lg text-label-large transition-all elevation-1 hover:elevation-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

