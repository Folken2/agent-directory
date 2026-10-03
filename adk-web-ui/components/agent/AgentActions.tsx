'use client';

import { useEffect, useState } from 'react';
import { Share2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { COMMUNITY_WRITES, fetchStarCounts, postStar } from '@/lib/stars-client';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/snackbar';

/** Client-only controls on the server-rendered agent page: star and share. */
export default function AgentActions({ name, displayName, description }: {
  name: string;
  displayName: string;
  description: string;
}) {
  const starredAgents = useAppStore((s) => s.starredAgents);
  const toggleStarAgent = useAppStore((s) => s.toggleStarAgent);
  const loadStarredAgents = useAppStore((s) => s.loadStarredAgents);
  const [starsCount, setStarsCount] = useState<number | undefined>(undefined);
  const isStarred = starredAgents.includes(name);

  useEffect(() => {
    if (!COMMUNITY_WRITES) return;
    loadStarredAgents();
    let cancelled = false;
    void fetchStarCounts().then((counts) => {
      if (!cancelled && counts.has(name)) setStarsCount(counts.get(name));
    });
    return () => {
      cancelled = true;
    };
  }, [name, loadStarredAgents]);

  const handleStar = async () => {
    const action = isStarred ? 'unstar' : 'star';
    const delta = action === 'star' ? 1 : -1;
    toggleStarAgent(name);
    setStarsCount((c) => (c === undefined ? c : Math.max(0, c + delta)));
    try {
      const count = await postStar(name, action);
      if (count !== null) setStarsCount(count);
    } catch {
      toggleStarAgent(name);
      setStarsCount((c) => (c === undefined ? c : Math.max(0, c - delta)));
      notify('Could not update the star');
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${displayName} - Agent Directory`, text: description, url });
      } catch {
        // User cancelled
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copied');
    } catch {
      notify('Could not copy the link');
    }
  };

  return (
    <>
      <Button variant="outlined" onClick={handleShare} aria-label="Share agent">
        <Share2 />
        Share
      </Button>
      {COMMUNITY_WRITES && (
        <Button
          variant="text"
          onClick={() => void handleStar()}
          aria-pressed={isStarred}
          aria-label={isStarred ? 'Unstar agent' : 'Star agent'}
        >
          <Star className={cn(isStarred && 'fill-current')} />
          {starsCount ? starsCount : isStarred ? 'Starred' : 'Star'}
        </Button>
      )}
    </>
  );
}
