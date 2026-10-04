'use client';

import type { ComponentType } from 'react';
import type { MessagePayload, PayloadType } from '@/lib/chat/payloads';
import { MarkdownRenderer } from '../markdown';
import InlineArtifact from '../../InlineArtifact';
import { MapsEmbed } from '../MapsEmbed';
import { GuideAnswer } from '../guide/GuideAnswer';
import { GuideMap } from '../guide/GuideMap';
import BuildCard from '../../build/BuildCard';

export type RendererProps<T extends PayloadType> = {
  payload: Extract<MessagePayload, { type: T }>;
  isDarkMode: boolean;
  isStreaming: boolean;
};

function TextRenderer({ payload, isDarkMode, isStreaming }: RendererProps<'text'>) {
  return (
    <div className="relative">
      <MarkdownRenderer content={payload.text} isStreaming={isStreaming} isDarkMode={isDarkMode} />
      {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
    </div>
  );
}

function ArtifactRenderer({ payload }: RendererProps<'artifact'>) {
  return (
    <div className="space-y-3">
      {payload.artifacts.map((artifact) => (
        <InlineArtifact key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
}

function MapsRenderer({ payload }: RendererProps<'maps'>) {
  return (
    <div className="space-y-3">
      {payload.captures.map((capture, idx) => (
        <MapsEmbed key={`${capture.captured_at}-${idx}`} capture={capture} />
      ))}
    </div>
  );
}

function GuideRenderer({ payload }: RendererProps<'guide'>) {
  return (
    <GuideAnswer
      document={payload.document}
      mapSlot={({ places, selectedPlaceId, onSelectPlace }) => (
        <GuideMap places={places} selectedPlaceId={selectedPlaceId} onSelectPlace={onSelectPlace} />
      )}
    />
  );
}

function BuildRenderer({ payload }: RendererProps<'build'>) {
  return <BuildCard build={payload.build} />;
}

/** One renderer per payload type; a new structured output adds an entry here. */
export const PAYLOAD_RENDERERS: { [K in PayloadType]: ComponentType<RendererProps<K>> } = {
  text: TextRenderer,
  artifact: ArtifactRenderer,
  maps: MapsRenderer,
  guide: GuideRenderer,
  build: BuildRenderer,
};

export function PayloadList({
  payloads,
  isDarkMode,
  isStreaming = false,
}: {
  payloads: MessagePayload[];
  isDarkMode: boolean;
  isStreaming?: boolean;
}) {
  return (
    <div className="space-y-4">
      {payloads.map((payload) => {
        const Renderer = PAYLOAD_RENDERERS[payload.type] as ComponentType<RendererProps<PayloadType>>;
        return <Renderer key={payload.type} payload={payload} isDarkMode={isDarkMode} isStreaming={isStreaming} />;
      })}
    </div>
  );
}
