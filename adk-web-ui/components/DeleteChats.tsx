'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/** 'all' for the whole history, or the session id of one conversation. */
export type DeleteTarget = 'all' | string;

/**
 * Confirm dialog for deleting signed-in chat history. Open while `target` is
 * set; calls `onDeleted` once the server has deleted it.
 */
export function DeleteChatsDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: DeleteTarget | null;
  onClose: () => void;
  onDeleted: (target: DeleteTarget) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!target) return;
    setDeleting(true);
    setError(null);
    const url = target === 'all' ? '/api/me/sessions' : `/api/me/sessions/${encodeURIComponent(target)}`;
    try {
      const res = await fetch(url, { method: 'DELETE' });
      // 404: already gone, which is what the user wanted.
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      onDeleted(target);
    } catch {
      setError('Could not delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (open || deleting) return;
        setError(null);
        onClose();
      }}
    >
      <DialogContent
        className="w-[min(420px,calc(100vw-32px))]"
        title={target === 'all' ? 'Delete all chats?' : 'Delete this chat?'}
        description={
          target === 'all'
            ? 'Your whole chat history, with every agent, is permanently deleted. This cannot be undone.'
            : 'The conversation is permanently deleted. This cannot be undone.'
        }
      >
        {error && <p className="text-sm text-md-error">{error}</p>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="text" disabled={deleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={confirm} disabled={deleting} className="bg-md-error text-md-on-error hover:bg-md-error/92">
            {deleting && <Loader2 className="animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bin button for one conversation on a server-rendered list; refreshes the page after. */
export function DeleteChatButton({ sessionId, label, className }: { sessionId: string; label: string; className?: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  return (
    <>
      <button
        type="button"
        aria-label={`Delete chat: ${label}`}
        title="Delete chat"
        onClick={() => setTarget(sessionId)}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-md-on-surface/8 hover:text-md-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary',
          className
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <DeleteChatsDialog
        target={target}
        onClose={() => setTarget(null)}
        onDeleted={() => {
          setTarget(null);
          router.refresh();
        }}
      />
    </>
  );
}

/** "Delete all chats" button for a server-rendered list; refreshes the page after. */
export function DeleteAllChatsButton() {
  const router = useRouter();
  const [target, setTarget] = useState<DeleteTarget | null>(null);
  return (
    <>
      <Button variant="outlined" onClick={() => setTarget('all')}>
        <Trash2 />
        Delete all chats
      </Button>
      <DeleteChatsDialog
        target={target}
        onClose={() => setTarget(null)}
        onDeleted={() => {
          setTarget(null);
          router.refresh();
        }}
      />
    </>
  );
}
