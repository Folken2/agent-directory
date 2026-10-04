'use client';

import { useState } from 'react';
import { Download, Mail, Package } from 'lucide-react';
import type { Build } from '@/lib/build/types';
import { enabledOptions, formatBytes, plural } from '@/lib/build/summary';
import { BUILDER_AGENT } from '@/lib/builder';
import { toSessionId } from '@/lib/ids';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { downloadBuildZip, type DownloadResult } from './download';
import EmailBuildDialog from './EmailBuildDialog';

const DOWNLOAD_PROBLEMS: Record<Exclude<DownloadResult, 'ok'>, string> = {
  gone: 'This zip is no longer on the server (the builder restarted). Ask the builder to package it again.',
  error: 'The download failed. Try again in a moment.',
};

/** The packaged project, inline in the chat: download it, or email yourself a permanent link. */
export default function BuildCard({ build }: { build: Build }) {
  const conversationId = useAppStore((s) => s.currentConversation?.id);
  const [downloading, setDownloading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  let sessionId: string | undefined;
  try {
    sessionId = conversationId ? toSessionId(conversationId) : undefined;
  } catch {
    sessionId = undefined;
  }

  const options = enabledOptions(build);
  const models = [build.models.fast, build.models.reasoning].filter((m): m is string => Boolean(m));

  const download = async () => {
    if (!sessionId || downloading) return;
    setDownloading(true);
    setProblem(null);
    const result = await downloadBuildZip(BUILDER_AGENT, sessionId, build);
    setDownloading(false);
    if (result !== 'ok') setProblem(DOWNLOAD_PROBLEMS[result]);
  };

  return (
    <>
      <Card variant="filled" className="p-5" role="group" aria-label={`Build: ${build.name}`}>
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--md-shape-md)] bg-md-primary-container text-md-on-primary-container">
            <Package className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-label-medium uppercase tracking-wider text-md-on-surface-variant">Your agent</p>
            <h3 className="text-title-medium text-md-on-surface">{build.name}</h3>
            {build.description ? (
              <p className="mt-1 line-clamp-3 text-body-medium text-md-on-surface-variant">{build.description}</p>
            ) : null}
            {options.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {options.map((o) => (
                  <Chip key={o} variant="category">
                    {o}
                  </Chip>
                ))}
              </div>
            ) : null}
            {models.length > 0 ? (
              <p className="mt-3 break-all text-label-medium text-md-on-surface-variant">Models: {models.join(' · ')}</p>
            ) : null}
            <p className="mt-1 text-label-medium text-md-on-surface-variant">
              {plural(build.files, 'file')} · {plural(build.tools.length, 'tool')} · {plural(build.skills.length, 'skill')} ·{' '}
              {formatBytes(build.bytes)}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col items-start gap-2">
          <Button size="sm" variant="tonal" onClick={download} disabled={!sessionId || downloading}>
            <Download /> {downloading ? 'Downloading…' : 'Download zip'}
          </Button>
          {problem ? (
            <p role="alert" className="text-body-medium text-md-error">
              {problem}
            </p>
          ) : null}
          <Button size="sm" variant="filled" onClick={() => setEmailOpen(true)} disabled={!sessionId}>
            <Mail /> Email me a permanent link
          </Button>
        </div>
      </Card>

      <EmailBuildDialog open={emailOpen} onOpenChange={setEmailOpen} build={build} sessionId={sessionId} />
    </>
  );
}
