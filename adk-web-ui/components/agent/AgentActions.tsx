'use client';

import { useEffect, useState } from 'react';
import { Share2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { notify } from '@/components/ui/snackbar';

const COMMUNITY_WRITES = process.env.NEXT_PUBLIC_COMMUNITY_WRITE_ENABLED === 'true';

/** Client-only controls on the server-rendered agent page: star and share. */
export default function AgentActions({ name, displayName, description }: {
  name: string;
  displayName: string;
  description: string;
}) {
  const { toggleStarAgent, isAgentStarred, loadPreferences } = useAppStore();
  const [starsCount, setStarsCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!COMMUNITY_WRITES) return;
    loadPreferences();
    let cancelled = false;
    fetch('/api/agents')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const agent = Array.isArray(json?.data)
          ? (json.data as Array<{ name: string; starsCount?: number }>).find((a) => a.name === name)
          : undefined;
        if (!cancelled && typeof agent?.starsCount === 'number') setStarsCount(agent.starsCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name, loadPreferences]);

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

  const isStarred = isAgentStarred(name);

  return (
    <>
      {COMMUNITY_WRITES && (
        <Button
          variant={isStarred ? 'filled' : 'tonal'}
          onClick={() => toggleStarAgent(name)}
          aria-label={isStarred ? 'Unstar agent' : 'Star agent'}
        >
          <Star className={cn(isStarred && 'fill-current')} />
          {isStarred ? 'Starred' : 'Star'}
          {starsCount !== undefined && <span className="text-sm">({starsCount})</span>}
        </Button>
      )}
      <Button variant="outlined" onClick={handleShare} aria-label="Share agent">
        <Share2 />
        Share
      </Button>
    </>
  );
}
