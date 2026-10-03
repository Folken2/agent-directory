'use client';

import { useState } from 'react';
import { FileText, PanelRight, Save } from 'lucide-react';
import type { Blueprint } from '@/lib/blueprint/types';
import { blueprintFileName, blueprintToMarkdown } from '@/lib/blueprint/markdown';
import { useAppStore } from '@/lib/store';
import { toSessionId } from '@/lib/ids';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import BlueprintPanel from './BlueprintPanel';
import SaveBlueprintDialog from './SaveBlueprintDialog';

/** Inline summary in the chat; opens the full blueprint in a side panel. */
export default function BlueprintCard({ blueprint }: { blueprint: Blueprint }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const conversationId = useAppStore((s) => s.currentConversation?.id);

  let sessionId: string | undefined;
  try {
    sessionId = conversationId ? toSessionId(conversationId) : undefined;
  } catch {
    sessionId = undefined;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(blueprintToMarkdown(blueprint));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the download still works.
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([blueprintToMarkdown(blueprint)], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = blueprintFileName(blueprint);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const openSave = () => {
    setPanelOpen(false);
    setSaveOpen(true);
  };

  return (
    <>
      <Card variant="filled" className="p-5" aria-label={`Blueprint: ${blueprint.name}`} role="group">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--md-shape-md)] bg-md-primary-container text-md-on-primary-container">
            <FileText className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-label-medium uppercase tracking-wider text-md-on-surface-variant">Blueprint</p>
            <h3 className="text-title-medium text-md-on-surface">{blueprint.name}</h3>
            <p className="mt-1 text-body-medium text-md-on-surface-variant line-clamp-2">{blueprint.goal}</p>
            <p className="mt-2 text-label-medium text-md-on-surface-variant">
              {blueprint.agents.length} {blueprint.agents.length === 1 ? 'agent' : 'agents'} · {blueprint.tools.length}{' '}
              {blueprint.tools.length === 1 ? 'tool' : 'tools'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="tonal" onClick={() => setPanelOpen(true)}>
            <PanelRight /> Open blueprint
          </Button>
          <Button size="sm" variant="outlined" onClick={openSave}>
            <Save /> Save blueprint
          </Button>
        </div>
      </Card>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="right" title="Blueprint" className="w-[min(560px,100vw)]">
          <BlueprintPanel blueprint={blueprint} copied={copied} onCopy={copy} onDownload={download} onSave={openSave} />
        </SheetContent>
      </Sheet>

      <SaveBlueprintDialog open={saveOpen} onOpenChange={setSaveOpen} blueprint={blueprint} sessionId={sessionId} />
    </>
  );
}
