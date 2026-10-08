'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CalendarDays, MailCheck } from 'lucide-react';
import type { Build } from '@/lib/build/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; email: string; sent: boolean; bookingUrl: string | null; link: string | null }
  | { kind: 'error'; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const checkboxClass = 'mt-1 size-4 accent-md-primary';
const optionClass = 'flex items-start gap-3 text-body-medium text-md-on-surface-variant';

export default function EmailBuildDialog({
  open,
  onOpenChange,
  build,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  build: Build;
  sessionId?: string;
}) {
  const { data: session } = useSession();
  // null until the user types, so a signed-in email can prefill but still be cleared.
  const [email, setEmail] = useState<string | null>(null);
  const [updates, setUpdates] = useState(false);
  const [help, setHelp] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inFlight = useRef(false);
  const effectiveEmail = (email ?? session?.user?.email ?? '').trim();
  const canSubmit = Boolean(sessionId) && EMAIL_RE.test(effectiveEmail) && status.kind !== 'sending';

  const submit = async () => {
    if (!canSubmit || !sessionId || inFlight.current) return;
    inFlight.current = true;
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: effectiveEmail, sessionId, updates, help }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setStatus({
          kind: 'error',
          message: typeof json?.error === 'string' ? json.error : "We couldn't send the link. Try again in a moment.",
        });
        return;
      }
      const data = (json.data ?? {}) as Record<string, unknown>;
      setStatus({
        kind: 'done',
        email: effectiveEmail,
        sent: data.sent === true,
        bookingUrl: typeof data.bookingUrl === 'string' ? data.bookingUrl : null,
        link: typeof data.link === 'string' ? data.link : null,
      });
    } catch {
      setStatus({ kind: 'error', message: "We couldn't send the link. Check your connection and try again." });
    } finally {
      inFlight.current = false;
    }
  };

  const done = status.kind === 'done' ? status : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next && done) setStatus({ kind: 'idle' });
      }}
    >
      <DialogContent
        title={done ? (done.sent ? 'Check your inbox' : 'Your build link') : 'Email me a permanent link'}
        description={
          done ? undefined : `We'll email you a private link to ${build.artifact}. It keeps working after this chat is gone.`
        }
      >
        {done ? (
          <div className="space-y-4">
            {done.sent ? (
              <p className="flex items-start gap-2 text-body-medium text-md-on-surface-variant">
                <MailCheck className="mt-0.5 size-5 shrink-0 text-md-primary" aria-hidden />
                We sent a link to {done.email}.
              </p>
            ) : null}
            {done.link ? (
              <div className="space-y-1">
                <p className="text-body-medium text-md-on-surface-variant">
                  Email isn&apos;t set up on this server, so here is your link:
                </p>
                <a href={done.link} className="break-all text-body-medium text-md-primary underline underline-offset-2">
                  {done.link}
                </a>
              </div>
            ) : null}
            {done.bookingUrl ? (
              <a href={done.bookingUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'filled' })}>
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
                value={email ?? session?.user?.email ?? ''}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className={optionClass}>
              <input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} className={checkboxClass} />
              <span>Send me updates about the builder and nuvel</span>
            </label>
            <label className={optionClass}>
              <input type="checkbox" checked={help} onChange={(e) => setHelp(e.target.checked)} className={checkboxClass} />
              <span>I&apos;d like help deploying it</span>
            </label>
            <p className="text-body-small text-md-on-surface-variant">
              We store your email and this build to send the link and serve the download. See the{' '}
              <Link href="/privacy#builds" target="_blank" className="text-md-primary underline underline-offset-2">
                privacy policy
              </Link>
              .
            </p>
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
                {status.kind === 'sending' ? 'Sending…' : 'Send link'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
