'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';

export default function BuildLinkActions({ token, fileName }: { token: string; fileName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle');

  const remove = async () => {
    setStatus('deleting');
    try {
      const res = await fetch(`/api/builds/${encodeURIComponent(token)}`, { method: 'DELETE' });
      // 404: already deleted elsewhere; refresh shows "Build deleted".
      if (res.ok || res.status === 404) {
        router.refresh();
        return;
      }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      <a href={`/api/builds/${encodeURIComponent(token)}/zip`} download={fileName} className={buttonVariants({ variant: 'filled' })}>
        <Download /> Download zip
      </a>
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <Button variant="outlined" onClick={remove} disabled={status === 'deleting'}>
              {status === 'deleting' ? 'Deleting…' : 'Yes, delete it'}
            </Button>
            <Button variant="text" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="text" onClick={() => setConfirming(true)}>
            <Trash2 /> Delete this build
          </Button>
        )}
      </div>
      {confirming ? (
        <p className="text-body-medium text-md-on-surface-variant">
          This removes the zip and your email address. The link will stop working.
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className="text-body-medium text-md-error">
          Could not delete the build. Try again in a moment.
        </p>
      ) : null}
    </div>
  );
}
