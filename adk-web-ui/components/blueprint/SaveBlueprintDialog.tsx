'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import type { Blueprint } from '@/lib/blueprint/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; bookingUrl: string | null }
  | { kind: 'error'; message: string };

export default function SaveBlueprintDialog({
  open,
  onOpenChange,
  blueprint,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blueprint: Blueprint;
  sessionId?: string;
}) {
  const { data: session } = useSession();
  // null until the user types, so a signed-in email can prefill but still be cleared.
  const [email, setEmail] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const effectiveEmail = email ?? session?.user?.email ?? '';
  const canSubmit = consent && /\S+@\S+\.\S+/.test(effectiveEmail) && status.kind !== 'saving';

  const submit = async () => {
    if (!canSubmit) return;
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/blueprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: effectiveEmail, consent: true, blueprint, sessionId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setStatus({ kind: 'error', message: typeof json?.error === 'string' ? json.error : 'Could not save your blueprint. Try again in a moment.' });
        return;
      }
      setStatus({ kind: 'saved', bookingUrl: typeof json.data?.bookingUrl === 'string' ? json.data.bookingUrl : null });
    } catch {
      setStatus({ kind: 'error', message: 'Could not save your blueprint. Check your connection and try again.' });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next && status.kind === 'saved') setStatus({ kind: 'idle' });
      }}
    >
      <DialogContent
        title={status.kind === 'saved' ? 'Blueprint saved' : 'Save your blueprint?'}
        description={
          status.kind === 'saved'
            ? undefined
            : 'We store this blueprint with your email so we can follow up about building it. We only use your email for that.'
        }
      >
        {status.kind === 'saved' ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-body-medium text-md-on-surface-variant">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-md-primary" aria-hidden />
              We saved “{blueprint.name}” and will be in touch at {effectiveEmail}.
            </p>
            {status.bookingUrl ? (
              <a
                href={status.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'filled' })}
              >
                <CalendarDays /> Book a call
              </a>
            ) : null}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            <label className="block space-y-1.5">
              <span className="text-label-large text-md-on-surface">Email</span>
              <Input
                type="email"
                required
                autoComplete="email"
                value={effectiveEmail}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="flex items-start gap-3 text-body-medium text-md-on-surface-variant">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-4 accent-md-primary"
              />
              <span>
                I agree that this blueprint and my email are stored and that I may be contacted about it.
                See the{' '}
                <a href="/privacy" target="_blank" className="text-md-primary underline underline-offset-2">
                  privacy policy
                </a>
                .
              </span>
            </label>
            {status.kind === 'error' ? (
              <p role="alert" className="text-body-medium text-md-error">
                {status.message}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="text" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {status.kind === 'saving' ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
